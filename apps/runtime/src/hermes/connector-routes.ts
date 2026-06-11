import fs from 'node:fs/promises';
import path from 'node:path';
import {
    agentRuntimeConnectorListSchema,
    agentRuntimeConnectorTestResultSchema,
    agentRuntimeDeleteConnectorResultSchema,
    agentRuntimeSaveConnectorResultSchema,
    agentRuntimeSaveConnectorSchema,
} from '@tavern/api';
import { badRequest, json, notFound } from '../tavern/http';
import {
    connectorIdFromName,
    deleteConnector,
    getConnector,
    listConnectors,
    saveConnector,
} from './connectors';
import { writeManagedHermesConfigFile } from './model-config';
import { requestManagedHermesRestart } from './supervisor';

export async function handleConnectorsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'connectors') {
        return null;
    }

    if (request.method === 'GET' && !segments[1]) {
        return json(agentRuntimeConnectorListSchema.parse({ connectors: listConnectors() }));
    }

    if (request.method === 'POST' && !segments[1]) {
        const input = agentRuntimeSaveConnectorSchema.parse(await readJson(request));
        return await saveAndApply(uniqueConnectorId(input.name), input);
    }

    if (request.method === 'PUT' && segments[1] && !segments[2]) {
        if (!getConnector(segments[1])) {
            return notFound();
        }
        const input = agentRuntimeSaveConnectorSchema.parse(await readJson(request));
        return await saveAndApply(segments[1], input);
    }

    if (request.method === 'DELETE' && segments[1] && !segments[2]) {
        const deleted = deleteConnector(segments[1]);
        const restartScheduled = deleted ? await applyConnectorConfig() : false;
        return json(
            agentRuntimeDeleteConnectorResultSchema.parse({
                deleted,
                id: segments[1],
                restartScheduled,
            })
        );
    }

    if (request.method === 'POST' && segments[1] && segments[2] === 'test') {
        const connector = getConnector(segments[1]);
        if (!connector) {
            return notFound();
        }
        return json(
            agentRuntimeConnectorTestResultSchema.parse({
                id: segments[1],
                ...(await testConnector(connector.stored)),
            })
        );
    }

    return null;
}

async function saveAndApply(id: string, input: Parameters<typeof saveConnector>[1]) {
    let saved: ReturnType<typeof saveConnector>;
    try {
        saved = saveConnector(id, input);
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
    const restartScheduled = await applyConnectorConfig();
    return json(agentRuntimeSaveConnectorResultSchema.parse({ ...saved, restartScheduled }));
}

async function applyConnectorConfig() {
    await writeManagedHermesConfigFile();
    return requestManagedHermesRestart();
}

function uniqueConnectorId(name: string) {
    const base = connectorIdFromName(name);
    if (!getConnector(base)) {
        return base;
    }
    for (let suffix = 2; ; suffix += 1) {
        const candidate = `${base}-${suffix}`;
        if (!getConnector(candidate)) {
            return candidate;
        }
    }
}

/**
 * Configuration sanity check, not a full protocol handshake: a command must
 * resolve to an executable; a URL must answer over HTTP at all.
 */
async function testConnector(stored: {
    command: string | null;
    transport: 'command' | 'url';
    url: string | null;
}): Promise<{ message: string; ok: boolean }> {
    if (stored.transport === 'command') {
        const command = stored.command ?? '';
        const resolved = await resolveExecutable(command);
        return resolved
            ? { message: `Command resolves to ${resolved}.`, ok: true }
            : { message: `Command "${command}" was not found on PATH.`, ok: false };
    }

    const url = stored.url ?? '';
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        return { message: `Reachable (HTTP ${response.status}).`, ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { message: `Not reachable: ${message}`, ok: false };
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
