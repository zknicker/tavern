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
        await initRuntimeTestDb();
    });

    afterEach(async () => {
        server?.close();
        server = null;
        await closeRuntimeTestDb();
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

    it('stages attachments and applies the session model before prompt.submit', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];

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

                if (request.method === 'image.attach_bytes') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { path: '/workspace/cat.png' },
                        })
                    );
                    return;
                }

                if (request.method === 'file.attach') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { ref_text: '@file:/workspace/notes.pdf' },
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

        await drain(
            client.streamChat({
                attachments: [
                    {
                        dataBase64: 'aW1hZ2U=',
                        filename: 'cat.png',
                        mediaType: 'image/png',
                        sizeBytes: 5,
                        type: 'inline',
                    },
                    {
                        dataBase64: 'cGRm',
                        filename: 'notes.pdf',
                        mediaType: 'application/pdf',
                        sizeBytes: 3,
                        type: 'inline',
                    },
                ],
                content: 'summarize this',
                modelRef: 'openai/gpt-5',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(requests).toEqual([
            { method: 'session.create', params: { title: 'agent:main:tavern:cht_1' } },
            {
                method: 'slash.exec',
                params: {
                    command: 'model gpt-5 --provider openai',
                    session_id: 'live-created',
                },
            },
            {
                method: 'image.attach_bytes',
                params: {
                    content_base64: 'aW1hZ2U=',
                    filename: 'cat.png',
                    session_id: 'live-created',
                },
            },
            {
                method: 'file.attach',
                params: {
                    data_url: 'data:application/pdf;base64,cGRm',
                    name: 'notes.pdf',
                    session_id: 'live-created',
                },
            },
            {
                method: 'prompt.submit',
                params: {
                    session_id: 'live-created',
                    text: '@image:/workspace/cat.png\n@file:/workspace/notes.pdf\n\nsummarize this',
                },
            },
        ]);
    });
});

describe('LocalHermesClient adapter-owned state', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let httpServer: ReturnType<typeof Bun.serve> | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-state-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        vi.resetModules();
        await initRuntimeTestDb();
    });

    afterEach(async () => {
        httpServer?.stop(true);
        httpServer = null;
        await closeRuntimeTestDb();
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
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
        });

        const agents = await client.listAgents();

        expect(agents.agents[0]).toMatchObject({
            hermesModelName: {
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

    it('toggles Hermes skills by runtime skill name', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'GET' && url.pathname === '/api/skills') {
                    return Response.json([
                        {
                            description: 'Reads pages.',
                            enabled: true,
                            name: 'browser',
                        },
                    ]);
                }
                if (request.method === 'PUT' && url.pathname === '/api/skills/toggle') {
                    requests.push({
                        body: await request.json(),
                        method: request.method,
                        pathname: url.pathname,
                    });
                    return Response.json({ enabled: false, name: 'browser', ok: true });
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

        const updated = await client.updateSkillEnabled('browser', { enabled: false });

        expect(requests).toEqual([
            {
                body: { enabled: false, name: 'browser' },
                method: 'PUT',
                pathname: '/api/skills/toggle',
            },
        ]);
        expect(updated).toMatchObject({
            disabled: true,
            id: 'browser',
            userInvocable: false,
        });
    });

    it('toggles Hermes toolsets by runtime toolset name', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        let enabled = true;
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'GET' && url.pathname === '/api/tools/toolsets') {
                    return Response.json([
                        {
                            configured: true,
                            description: 'Web tools.',
                            enabled,
                            label: 'Web',
                            name: 'web',
                            tools: ['search.web'],
                        },
                    ]);
                }
                if (request.method === 'PUT' && url.pathname === '/api/tools/toolsets/web') {
                    const body = (await request.json()) as { enabled: boolean };
                    enabled = body.enabled;
                    requests.push({
                        body,
                        method: request.method,
                        pathname: url.pathname,
                    });
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

        const updated = await client.updateToolsetEnabled('web', { enabled: false });

        expect(requests).toEqual([
            {
                body: { enabled: false },
                method: 'PUT',
                pathname: '/api/tools/toolsets/web',
            },
        ]);
        expect(updated).toMatchObject({
            enabled: false,
            id: 'web',
            name: 'web',
            tools: ['search.web'],
        });
    });

    it('uses Hermes Cron API for create, update, list, run, and delete', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        let jobDeleted = false;
        let job = {
            created_at: '2026-06-08T10:00:00.000Z',
            deliver: 'tavern:cht_cron',
            enabled: true,
            id: 'hermes_job_1',
            name: 'Daily check',
            next_run_at: '2026-06-08T10:01:00.000Z',
            prompt: 'check in',
            schedule: { kind: 'interval', minutes: 1 },
            state: 'scheduled',
        };

        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                const body =
                    request.method === 'GET' ? null : await request.json().catch(() => null);
                requests.push({ body, method: request.method, pathname: url.pathname });

                if (request.method === 'POST' && url.pathname === '/api/cron/jobs') {
                    job = { ...job, ...(body as Record<string, unknown>) };
                    return Response.json(job);
                }
                if (request.method === 'PUT' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    const updates = ((body as { updates?: Record<string, unknown> })?.updates ??
                        {}) as Record<string, unknown> | undefined;
                    job = { ...job, ...(updates ?? {}) };
                    return Response.json(job);
                }
                if (
                    request.method === 'POST' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/pause'
                ) {
                    job = { ...job, enabled: false, state: 'paused' };
                    return Response.json(job);
                }
                if (
                    request.method === 'POST' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/trigger'
                ) {
                    return Response.json({ ok: true });
                }
                if (request.method === 'GET' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    return Response.json(job);
                }
                if (request.method === 'GET' && url.pathname === '/api/cron/jobs') {
                    return Response.json(jobDeleted ? [] : [job]);
                }
                if (
                    request.method === 'GET' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/runs'
                ) {
                    return Response.json({
                        runs: [
                            {
                                ended_at: 1_780_000_060,
                                id: 'cron_hermes_job_1_1780000000',
                                last_active: 1_780_000_060,
                                preview: 'cron completed',
                                started_at: 1_780_000_000,
                            },
                        ],
                    });
                }
                if (request.method === 'DELETE' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    jobDeleted = true;
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

        const created = await client.createCronJob({
            agentId: 'agt_hermes',
            delivery: { chatId: 'cht_cron' },
            enabled: false,
            id: 'cron_1',
            name: 'Daily check',
            payload: { kind: 'agentTurn', message: 'check in' },
            schedule: { everyMs: 60_000, kind: 'every' },
            wakeMode: 'now',
        });
        const jobId = created.id;
        await client.updateCronJob(jobId, {
            enabled: false,
            name: 'Paused daily check',
        });
        const listed = await client.listCronJobs();
        const run = await client.runCronJob(jobId);
        const runs = await client.listCronRuns(jobId);
        const deletedResult = await client.deleteCronJob(jobId);

        expect(created).toMatchObject({
            delivery: { chatId: 'cht_cron' },
            id: 'hermes_job_1',
            name: 'Daily check',
        });
        expect(listed.jobs).toHaveLength(1);
        expect(listed.jobs[0]).toMatchObject({
            enabled: false,
            id: 'hermes_job_1',
            name: 'Paused daily check',
        });
        expect(run).toMatchObject({
            jobId,
            status: 'running',
            trigger: 'manual',
        });
        expect(runs.runs).toHaveLength(1);
        expect(runs.runs[0]).toMatchObject({
            jobId,
            sessionId: 'cron_hermes_job_1_1780000000',
            status: 'success',
            summary: 'cron completed',
        });
        expect(deletedResult).toEqual({ archived: true, id: jobId });
        await expect(client.listCronJobs()).resolves.toMatchObject({ jobs: [] });
        expect(requests.slice(0, 3)).toMatchObject([
            {
                body: {
                    deliver: 'tavern:cht_cron',
                    name: 'Daily check',
                    prompt: 'check in',
                    schedule: 'every 1m',
                },
                method: 'POST',
                pathname: '/api/cron/jobs',
            },
            { method: 'POST', pathname: '/api/cron/jobs/hermes_job_1/pause' },
            {
                body: { updates: { name: 'Paused daily check' } },
                method: 'PUT',
                pathname: '/api/cron/jobs/hermes_job_1',
            },
        ]);
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

async function initRuntimeTestDb() {
    const [{ initTestDb }, { ensureRuntimeSchema }] = await Promise.all([
        import('../db/connection'),
        import('../db/schema'),
    ]);
    ensureRuntimeSchema(initTestDb());
}

async function closeRuntimeTestDb() {
    const { closeDb } = await import('../db/connection');
    closeDb();
}
