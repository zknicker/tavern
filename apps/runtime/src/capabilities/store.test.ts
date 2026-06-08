import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureCortexRuntimeBootstrap } from '../cortex/bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from '../cortex/db';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { runtimeCapabilitiesRefreshJob } from '../jobs/definitions';
import { startRuntimeJobsManager } from '../jobs/manager';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { handleTavernRuntimeRequest } from '../tavern/router';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import { getRuntimeCapability, listRuntimeCapabilities, refreshRuntimeCapabilities } from './store';

describe('Runtime capabilities store', () => {
    let runtimeRoot: string;
    let hermesMock: ReturnType<typeof Bun.serve> | null = null;
    const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
    const originalHermesPort = process.env.TAVERN_HERMES_PORT;
    const originalPath = process.env.PATH;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-capabilities-'));
        const binPath = path.join(runtimeRoot, 'bin');
        await mkdir(binPath, { recursive: true });
        await writeFile(path.join(binPath, 'codex'), '#!/bin/sh\necho codex-test\n', {
            mode: 0o755,
        });
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
        process.env.OPENAI_API_KEY = '';
        process.env.PATH = binPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = path.join(runtimeRoot, 'cortex-wiki');
        process.env.TAVERN_HERMES_PORT = '1';
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        hermesMock?.stop(true);
        hermesMock = null;
        closeDb();
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.OPENAI_API_KEY = originalOpenAiApiKey;
        process.env.TAVERN_HERMES_PORT = originalHermesPort;
        process.env.PATH = originalPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('lists expected Runtime capabilities before the first refresh', () => {
        const capabilities = listRuntimeCapabilities();

        expect(capabilities.map((capability) => capability.id)).toEqual([
            'apiServer',
            'codexOAuth',
            'cortexDatabase',
            'cortexImportProcessors',
            'cortexJobs',
            'cortexModelAccess',
            'cortexWiki',
            'dashboardServer',
            'embeddingModel',
            'gateway',
            'models',
            'skills',
        ]);
        expect(getRuntimeCapability('embeddingModel')).toMatchObject({
            checkedAt: null,
            healthy: false,
            reason: 'Capability has not been checked yet.',
            state: 'unknown',
        });
    });

    test('scheduled Runtime capability refresh publishes update events for written rows', async () => {
        const events: string[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => {
            if (event.type === 'capability.updated') {
                events.push(event.capability);
            }
        });

        try {
            await runtimeCapabilitiesRefreshJob.run({
                input: {},
                log: async () => undefined,
                trigger: 'manual',
            });
        } finally {
            unsubscribe();
        }

        expect(events).toContain('gateway');
        expect(events).toContain('apiServer');
        expect(events).toContain('dashboardServer');
    });

    test('records empty Cortex database and wiki capabilities as healthy', async () => {
        const capabilities = await refreshRuntimeCapabilities({
            ids: ['cortexDatabase', 'cortexWiki'],
        });

        expect(capabilities.map((capability) => capability.id).sort()).toEqual([
            'cortexDatabase',
            'cortexWiki',
        ]);
        expect(capabilities.every((capability) => capability.healthy)).toBe(true);
        expect(getRuntimeCapability('cortexDatabase')).toMatchObject({
            healthy: true,
            state: 'healthy',
        });
    });

    test('records Cortex jobs unavailable until the Runtime jobs manager is active', async () => {
        const [jobs] = await refreshRuntimeCapabilities({
            ids: ['cortexJobs'],
        });

        expect(jobs).toMatchObject({
            healthy: false,
            id: 'cortexJobs',
            metadata: {
                expected: 6,
                registered: 0,
            },
            reason: 'Cortex Runtime jobs are not registered.',
            state: 'unavailable',
        });
    });

    test('records Cortex jobs healthy when required queues are registered', async () => {
        const manager = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: path.join(runtimeRoot, 'runtime-jobs.sqlite'),
        });
        try {
            const [jobs] = await refreshRuntimeCapabilities({
                ids: ['cortexJobs'],
            });

            expect(jobs).toMatchObject({
                healthy: true,
                id: 'cortexJobs',
                metadata: {
                    expected: 6,
                    registered: 6,
                },
                state: 'healthy',
            });
        } finally {
            await manager.stop();
        }
    });

    test('records Cortex model access as unavailable when configured providers lack credentials', async () => {
        const [modelAccess] = await refreshRuntimeCapabilities({
            ids: ['cortexModelAccess'],
        });

        expect(modelAccess).toMatchObject({
            healthy: false,
            id: 'cortexModelAccess',
            metadata: {
                missing: expect.arrayContaining(['openai', 'openrouter']),
                providers: ['openai', 'openai-codex', 'openrouter'],
            },
            reason: 'Cortex model access is missing openai, openrouter.',
            state: 'unavailable',
        });
    });

    test('records Cortex rich import processors from hard extraction dependencies', async () => {
        const [missingOpenAi] = await refreshRuntimeCapabilities({
            ids: ['cortexImportProcessors'],
        });

        expect(missingOpenAi).toMatchObject({
            healthy: false,
            id: 'cortexImportProcessors',
            metadata: {
                missing: ['openai'],
            },
            state: 'unavailable',
        });

        await saveTestOpenAiKey();

        const [processors] = await refreshRuntimeCapabilities({
            ids: ['cortexImportProcessors'],
        });

        expect(processors).toMatchObject({
            healthy: true,
            id: 'cortexImportProcessors',
            metadata: {
                supportedKinds: expect.arrayContaining(['audio', 'image', 'pdf', 'video']),
            },
            state: 'healthy',
        });
    });

    test('records Codex OAuth as unavailable without Codex auth', async () => {
        const [codexAccess] = await refreshRuntimeCapabilities({
            ids: ['codexOAuth'],
        });

        expect(codexAccess).toMatchObject({
            healthy: false,
            id: 'codexOAuth',
            reason: 'Codex OAuth credentials are not configured.',
            state: 'unauthorized',
        });
    });

    test('records Codex OAuth as unavailable when Codex CLI is missing', async () => {
        process.env.PATH = path.join(runtimeRoot, 'missing-bin');

        const [codexAccess] = await refreshRuntimeCapabilities({
            ids: ['codexOAuth'],
        });

        expect(codexAccess).toMatchObject({
            healthy: false,
            id: 'codexOAuth',
            reason: 'Codex CLI is not available to Tavern Runtime.',
            state: 'unavailable',
        });
    });

    test('records Codex OAuth from Codex OAuth credentials', async () => {
        const codexHome = path.join(runtimeRoot, 'codex-home');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: {
                    access_token: 'codex-access-token',
                    account_id: 'account-1',
                },
            })
        );
        process.env.CODEX_HOME = codexHome;

        const [codexAccess] = await refreshRuntimeCapabilities({
            ids: ['codexOAuth'],
        });

        expect(codexAccess).toMatchObject({
            healthy: true,
            id: 'codexOAuth',
            metadata: {
                accountId: 'account-1',
                source: 'file',
            },
            state: 'healthy',
        });
    });

    test('marks Hermes capabilities unavailable when managed Hermes is down', async () => {
        const capabilities = await refreshRuntimeCapabilities({
            ids: ['dashboardServer', 'apiServer', 'gateway', 'models', 'skills'],
        });

        expect(
            capabilities.map((capability) => ({
                id: capability.id,
                state: capability.state,
            }))
        ).toEqual([
            { id: 'dashboardServer', state: 'unavailable' },
            { id: 'apiServer', state: 'unavailable' },
            { id: 'gateway', state: 'unavailable' },
            { id: 'models', state: 'unavailable' },
            { id: 'skills', state: 'unavailable' },
        ]);
    });

    test('marks Hermes capabilities healthy from dashboard, API, Gateway, model, and skill probes', async () => {
        hermesMock = startHermesCapabilityMock();
        process.env.TAVERN_HERMES_PORT = `${hermesMock.port}`;

        const capabilities = await refreshRuntimeCapabilities({
            ids: ['dashboardServer', 'apiServer', 'gateway', 'models', 'skills'],
        });

        expect(
            capabilities.map((capability) => ({
                id: capability.id,
                state: capability.state,
            }))
        ).toEqual([
            { id: 'dashboardServer', state: 'healthy' },
            { id: 'apiServer', state: 'healthy' },
            { id: 'gateway', state: 'healthy' },
            { id: 'models', state: 'healthy' },
            { id: 'skills', state: 'healthy' },
        ]);
    });

    test('records embedding model health from Runtime-owned checks', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        data: [{ id: 'text-embedding-3-small' }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );
        await saveTestOpenAiKey();

        const [embeddingModel] = await refreshRuntimeCapabilities({
            ids: ['embeddingModel'],
        });

        expect(embeddingModel).toMatchObject({
            healthy: true,
            id: 'embeddingModel',
            metadata: {
                model: 'text-embedding-3-small',
                provider: 'openai',
                quotaVerified: false,
            },
            state: 'healthy',
        });
        expect(getRuntimeCapability('embeddingModel').lastHealthyAt).toBeTruthy();
    });
});

async function saveTestOpenAiKey() {
    await handleTavernRuntimeRequest(
        new Request('http://runtime.test/model-access/openai', {
            body: JSON.stringify({ apiKey: 'sk-test-cortex-000000000000' }),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
        })
    );
}

function startHermesCapabilityMock() {
    return Bun.serve({
        fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/api/ws') {
                if (server.upgrade(request)) {
                    return;
                }
                return json({ detail: 'WebSocket upgrade failed' }, { status: 400 });
            }
            if (url.pathname === '/api/status' || url.pathname === '/health') {
                return json({ ok: true, status: 'ok' });
            }
            if (url.pathname === '/api/sessions') {
                return json({ sessions: [] });
            }
            if (url.pathname === '/api/model/options') {
                return json({
                    providers: [
                        { models: ['gpt-5.4-mini'], name: 'openai-codex', slug: 'openai-codex' },
                    ],
                });
            }
            if (url.pathname === '/api/skills') {
                return json({ skills: [{ id: 'agent-browser', name: 'Agent Browser' }] });
            }
            return json({ detail: 'not found' }, { status: 404 });
        },
        hostname: '127.0.0.1',
        port: 0,
        websocket: {
            message() {
                // Capability readiness only requires that Hermes accepts the Gateway socket.
            },
        },
    });
}

function json(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
}
