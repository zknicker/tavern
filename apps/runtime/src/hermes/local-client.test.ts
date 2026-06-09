import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

describe('LocalHermesClient session routing', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let server: WebSocketServer | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-client-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        vi.resetModules();
    });

    afterEach(async () => {
        server?.close();
        server = null;
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('creates once then resumes the Hermes stored session for the Tavern session key', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;
        let resumeCount = 0;

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};
                requests.push({ method: request.method, params });

                if (request.method === 'session.create') {
                    createCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'session.resume') {
                    resumeCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                resumed: params.session_id,
                                session_id: 'live-resumed',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: 'done' },
                                session_id: params.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await drain(client.streamChat({ content: 'first', sessionKey: 'agent:main:tavern:cht_1' }));
        await drain(
            client.streamChat({ content: 'second', sessionKey: 'agent:main:tavern:cht_1' })
        );
        client.close();

        expect(createCount).toBe(1);
        expect(resumeCount).toBe(1);
        expect(requests).toEqual([
            { method: 'session.create', params: { title: 'agent:main:tavern:cht_1' } },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-created', text: 'first' },
            },
            { method: 'session.resume', params: { session_id: 'stored-session' } },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-resumed', text: 'second' },
            },
        ]);
    });
});

describe('LocalHermesClient adapter-owned state', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let gatewayServer: WebSocketServer | null = null;
    let httpServer: ReturnType<typeof Bun.serve> | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-state-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        vi.resetModules();
    });

    afterEach(async () => {
        gatewayServer?.close();
        gatewayServer = null;
        httpServer?.stop(true);
        httpServer = null;
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('surfaces selected model, name, and thinking default in synced agent data', async () => {
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'POST' && url.pathname === '/api/model/set') {
                    return Response.json({ ok: true });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        await client.updateAgentName('agt_hermes', { name: 'Tavern Hermes' });
        await client.updateAgentThinkingDefault('agt_hermes', { thinkingDefault: 'medium' });
        await client.updateAgentModel('agt_hermes', {
            model: {
                harness: 'codex',
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
        });

        const agents = await client.listAgents();

        expect(agents.agents[0]).toMatchObject({
            hermesModelName: {
                harness: 'codex',
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
            name: 'Tavern Hermes',
            thinkingDefault: 'medium',
        });
    });

    it('keeps raw Hermes config invalid so server fixups do not call raw mutation', async () => {
        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        await expect(client.getHermesConfig()).resolves.toMatchObject({
            raw: null,
            valid: false,
        });
    });

    it('persists supported Hermes markdown files to their runtime locations', async () => {
        const { HERMES_HOME, HERMES_WORKSPACE } = await import('../config');
        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        await client.saveAgentFile('agt_hermes', 'AGENTS.md', {
            content: '# Workspace\n\nProject rules.',
        });
        await client.saveAgentFile('agt_hermes', 'SOUL.md', {
            content: '# Soul\n\nSpeak plainly.',
        });

        await expect(fs.readFile(path.join(HERMES_WORKSPACE, 'AGENTS.md'), 'utf8')).resolves.toBe(
            '# Workspace\n\nProject rules.'
        );
        await expect(fs.readFile(path.join(HERMES_HOME, 'SOUL.md'), 'utf8')).resolves.toBe(
            '# Soul\n\nSpeak plainly.'
        );
        await expect(client.listAgentFiles('agt_hermes')).resolves.toMatchObject({
            files: [
                { mediaType: 'text/markdown', path: 'AGENTS.md' },
                { mediaType: 'text/markdown', path: 'SOUL.md' },
            ],
        });
        await expect(client.getAgentFile('agt_hermes', 'TOOLS.md')).rejects.toThrow(
            'Hermes agent file "TOOLS.md"'
        );
    });

    it('persists adapter cron records for create, update, list, run, and delete', async () => {
        gatewayServer = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        gatewayServer.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'cron-live',
                                stored_session_id: 'cron-stored',
                            },
                        })
                    );
                    return;
                }
                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: 'cron completed' },
                                session_id: request.params?.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });
        await new Promise<void>((resolve) => gatewayServer?.once('listening', () => resolve()));
        const address = gatewayServer.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await expect(
            client.createCronJob({
                agentId: 'agt_hermes',
                id: 'cron_enabled',
                name: 'Enabled schedule',
                payload: { kind: 'agentTurn', message: 'check in' },
                schedule: { everyMs: 60_000, kind: 'every' },
                wakeMode: 'now',
            })
        ).rejects.toThrow('Hermes scheduled cron execution');
        await client.createCronJob({
            agentId: 'agt_hermes',
            enabled: false,
            id: 'cron_1',
            name: 'Daily check',
            payload: { kind: 'agentTurn', message: 'check in' },
            schedule: { everyMs: 60_000, kind: 'every' },
            wakeMode: 'now',
        });
        await client.updateCronJob('cron_1', {
            enabled: false,
            name: 'Paused daily check',
        });
        const listed = await client.listCronJobs();
        const run = await client.runCronJob('cron_1');
        const runs = await client.listCronRuns('cron_1');
        const deleted = await client.deleteCronJob('cron_1');

        expect(listed.jobs).toHaveLength(1);
        expect(listed.jobs[0]).toMatchObject({
            enabled: false,
            id: 'cron_1',
            name: 'Paused daily check',
        });
        expect(run).toMatchObject({
            jobId: 'cron_1',
            sessionId: 'cron-stored',
            status: 'success',
            summary: 'cron completed',
            trigger: 'manual',
        });
        expect(runs.runs).toHaveLength(1);
        expect(deleted).toEqual({ archived: true, id: 'cron_1' });
        await expect(client.listCronJobs()).resolves.toMatchObject({ jobs: [] });
    });
});

async function drain(generator: AsyncGenerator<unknown>) {
    for await (const _event of generator) {
        // Consume the stream.
    }
}

async function getFreePort() {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
    if (!(address && typeof address === 'object')) {
        throw new Error('Could not allocate a test port.');
    }
    return address.port;
}
