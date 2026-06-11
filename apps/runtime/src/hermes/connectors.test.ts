import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { parseDocument } from 'yaml';

const tempHermesHome = await vi.hoisted(async () => {
    const [{ mkdtempSync }, { tmpdir }, { join }] = await Promise.all([
        import('node:fs'),
        import('node:os'),
        import('node:path'),
    ]);
    const home = mkdtempSync(join(tmpdir(), 'tavern-hermes-home-'));
    process.env.TAVERN_HERMES_HOME = home;
    return home;
});

import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { handleConnectorsRequest } from './connector-routes';

const configPath = path.join(tempHermesHome, 'config.yaml');
const envPath = path.join(tempHermesHome, '.env');

describe('connectors', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(configPath, { force: true });
        await fs.rm(envPath, { force: true });
    });

    test('lists no connectors initially', async () => {
        const response = await handleConnectorsRequest(
            new Request('http://runtime.test/connectors')
        );
        await expect(response?.json()).resolves.toEqual({ connectors: [] });
    });

    test('creates a command connector and materializes secrets as env interpolation', async () => {
        const response = await postConnector({
            args: ['mcp-server'],
            command: 'github',
            env: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
            name: 'GitHub Tools',
            transport: 'command',
        });
        const body = (await response?.json()) as Record<string, unknown>;

        expect(response?.status).toBe(200);
        expect(body.id).toBe('github-tools');
        expect(body.env).toEqual([{ hasValue: true, name: 'GITHUB_TOKEN' }]);
        expect(JSON.stringify(body)).not.toContain('secret-token');

        const config = await readGeneratedConfig();
        expect(config.mcp_servers?.['github-tools']).toEqual({
            args: ['mcp-server'],
            command: 'github',
            env: { GITHUB_TOKEN: envRef('TAVERN_MCP_GITHUB_TOOLS_ENV_GITHUB_TOKEN') },
        });
        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain(
            'TAVERN_MCP_GITHUB_TOOLS_ENV_GITHUB_TOKEN="secret-token"'
        );
    });

    test('creates a url connector with write-only headers', async () => {
        await postConnector({
            headers: [{ name: 'Authorization', value: 'Bearer abc' }],
            name: 'Remote',
            timeoutSeconds: 45,
            transport: 'url',
            url: 'https://mcp.example.com/sse',
        });

        const config = await readGeneratedConfig();
        expect(config.mcp_servers?.remote).toEqual({
            headers: { Authorization: envRef('TAVERN_MCP_REMOTE_HDR_AUTHORIZATION') },
            timeout: 45,
            url: 'https://mcp.example.com/sse',
        });
        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain(
            'TAVERN_MCP_REMOTE_HDR_AUTHORIZATION="Bearer abc"'
        );
    });

    test('keeps stored secret values when a save omits them', async () => {
        await postConnector({
            command: 'github',
            env: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
            name: 'GitHub Tools',
            transport: 'command',
        });

        const response = await handleConnectorsRequest(
            new Request('http://runtime.test/connectors/github-tools', {
                body: JSON.stringify({
                    command: 'github',
                    env: [{ name: 'GITHUB_TOKEN' }],
                    name: 'GitHub Tools',
                    transport: 'command',
                }),
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(200);
        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain('secret-token');
    });

    test('rejects a new secret entry without a value', async () => {
        const response = await postConnector({
            command: 'github',
            env: [{ name: 'GITHUB_TOKEN' }],
            name: 'GitHub Tools',
            transport: 'command',
        });

        expect(response?.status).toBe(400);
    });

    test('suffixes duplicate connector names', async () => {
        await postConnector({ command: 'one', name: 'Tools', transport: 'command' });
        const response = await postConnector({
            command: 'two',
            name: 'Tools',
            transport: 'command',
        });
        const body = (await response?.json()) as { id: string };

        expect(body.id).toBe('tools-2');
    });

    test('deleting a connector removes its config entry and env secrets', async () => {
        await fs.writeFile(
            configPath,
            ['mcp_servers:', '  operator-server:', '    command: operator-cmd', ''].join('\n')
        );
        await postConnector({
            command: 'github',
            env: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
            name: 'GitHub Tools',
            transport: 'command',
        });

        const response = await handleConnectorsRequest(
            new Request('http://runtime.test/connectors/github-tools', { method: 'DELETE' })
        );
        const body = (await response?.json()) as { deleted: boolean };

        expect(body.deleted).toBe(true);
        const config = await readGeneratedConfig();
        expect(config.mcp_servers?.['github-tools']).toBeUndefined();
        expect(config.mcp_servers?.['operator-server']).toEqual({ command: 'operator-cmd' });
        const env = await fs.readFile(envPath, 'utf8').catch(() => '');
        expect(env).not.toContain('TAVERN_MCP_');
    });

    test('updating an unknown connector returns 404', async () => {
        const response = await handleConnectorsRequest(
            new Request('http://runtime.test/connectors/nope', {
                body: JSON.stringify({ command: 'x', name: 'X', transport: 'command' }),
                method: 'PUT',
            })
        );
        expect(response?.status).toBe(404);
    });

    test('test action resolves command availability', async () => {
        await postConnector({ command: 'sh', name: 'Shell', transport: 'command' });
        await postConnector({
            command: 'definitely-not-a-real-command-xyz',
            name: 'Ghost',
            transport: 'command',
        });

        expect(await runTest('shell')).toMatchObject({ ok: true });
        expect(await runTest('ghost')).toMatchObject({ ok: false });
    });

    test('test action probes url reachability', async () => {
        const server = createServer((_request, response) => response.end('ok'));
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address() as { port: number };

        try {
            await postConnector({
                name: 'Reachable',
                transport: 'url',
                url: `http://127.0.0.1:${address.port}/`,
            });
            await postConnector({
                name: 'Unreachable',
                transport: 'url',
                url: 'http://127.0.0.1:9/',
            });

            expect(await runTest('reachable')).toMatchObject({ ok: true });
            expect(await runTest('unreachable')).toMatchObject({ ok: false });
        } finally {
            server.close();
        }
    });
});

function envRef(name: string) {
    return ['${', name, '}'].join('');
}

async function postConnector(body: unknown) {
    return await handleConnectorsRequest(
        new Request('http://runtime.test/connectors', {
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        })
    );
}

async function runTest(id: string) {
    const response = await handleConnectorsRequest(
        new Request(`http://runtime.test/connectors/${id}/test`, { method: 'POST' })
    );
    return (await response?.json()) as { message: string; ok: boolean };
}

async function readGeneratedConfig() {
    return parseDocument(await fs.readFile(configPath, 'utf8')).toJS() as {
        mcp_servers?: Record<string, unknown>;
    };
}
