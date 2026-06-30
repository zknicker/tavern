import fs from 'node:fs/promises';
import path from 'node:path';
import {
    agentRuntimeMcpServerCreateSchema,
    agentRuntimeMcpServerListSchema,
    agentRuntimeMcpServerTestResultSchema,
} from '@tavern/api';
import { badRequest, json, notFound } from '../tavern/http';
import {
    getMcpServer,
    listMcpServers,
    mcpServerIdFromName,
    removeMcpServer,
    saveMcpServer,
} from './mcp-servers';
import { signalAgentSettingsApplied } from './settings-apply';

export async function handleMcpServersRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'mcp' || segments[1] !== 'servers') {
        return null;
    }

    const serverId = segments[2];
    const action = segments[3];

    if (request.method === 'GET' && !serverId) {
        return json(agentRuntimeMcpServerListSchema.parse({ servers: listMcpServers() }));
    }

    if (request.method === 'POST' && !serverId) {
        const input = agentRuntimeMcpServerCreateSchema.parse(await readJson(request));
        return await saveAndApply(uniqueMcpServerId(input.name), input);
    }

    if (request.method === 'PUT' && serverId && !action) {
        if (!getMcpServer(serverId)) {
            return notFound();
        }
        const input = agentRuntimeMcpServerCreateSchema.parse(await readJson(request));
        return await saveAndApply(serverId, input);
    }

    if (request.method === 'DELETE' && serverId && !action) {
        const deleted = removeMcpServer(serverId);
        const restartScheduled = deleted ? await applyMcpServerConfig() : false;
        return json({ deleted, ok: deleted, restartScheduled });
    }

    if (request.method === 'POST' && serverId && action === 'test') {
        const mcpServer = getMcpServer(serverId);
        if (!mcpServer) {
            return notFound();
        }
        return json(
            agentRuntimeMcpServerTestResultSchema.parse({
                ...(await testMcpServer(mcpServer.stored)),
                tools: [],
            })
        );
    }

    return null;
}

async function saveAndApply(id: string, input: Parameters<typeof saveMcpServer>[1]) {
    let saved: ReturnType<typeof saveMcpServer>;
    try {
        saved = saveMcpServer(id, input);
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
    const restartScheduled = await applyMcpServerConfig();
    return json({ ...saved, restartScheduled });
}

async function applyMcpServerConfig() {
    return signalAgentSettingsApplied();
}

function uniqueMcpServerId(name: string) {
    const base = mcpServerIdFromName(name);
    if (!getMcpServer(base)) {
        return base;
    }
    for (let suffix = 2; ; suffix += 1) {
        const candidate = `${base}-${suffix}`;
        if (!getMcpServer(candidate)) {
            return candidate;
        }
    }
}

/**
 * Configuration sanity check, not a full protocol handshake: a command must
 * resolve to an executable; a URL must answer over HTTP at all.
 */
async function testMcpServer(stored: {
    command: string | null;
    url: string | null;
}): Promise<{ error: string | null; ok: boolean }> {
    if (stored.command) {
        const command = stored.command ?? '';
        const resolved = await resolveExecutable(command);
        return resolved
            ? { error: null, ok: true }
            : { error: `Command "${command}" was not found on PATH.`, ok: false };
    }

    const url = stored.url ?? '';
    try {
        await fetch(url, { signal: AbortSignal.timeout(5000) });
        return { error: null, ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: `Not reachable: ${message}`, ok: false };
    }
}

async function resolveExecutable(command: string): Promise<string | null> {
    if (!command) {
        return null;
    }
    if (command.includes('/')) {
        return (await isExecutable(command)) ? command : null;
    }
    for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
        if (!dir) {
            continue;
        }
        const candidate = path.join(dir, command);
        if (await isExecutable(candidate)) {
            return candidate;
        }
    }
    return null;
}

async function isExecutable(filePath: string) {
    try {
        await fs.access(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
