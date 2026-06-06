import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureCortexRuntimeBootstrap } from '../cortex/bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from '../cortex/db';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { startRuntimeJobsManager } from '../jobs/manager';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import {
    markCortexPluginInstalled,
    markManagedOpenClawGatewayReady,
    markManagedOpenClawGatewayStopped,
} from '../openclaw/state';
import { replaceStoredOpenClawModels } from '../tavern/openclaw-snapshots-store';
import { handleTavernRuntimeRequest } from '../tavern/router';
import { getRuntimeCapability, listRuntimeCapabilities, refreshRuntimeCapabilities } from './store';

describe('Runtime capabilities store', () => {
    let runtimeRoot: string;
    const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
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
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        markCortexPluginInstalled(null);
        markManagedOpenClawGatewayStopped();
        closeDb();
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.OPENAI_API_KEY = originalOpenAiApiKey;
        process.env.PATH = originalPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('lists expected Runtime capabilities before the first refresh', () => {
        const capabilities = listRuntimeCapabilities();

        expect(capabilities.map((capability) => capability.id)).toEqual([
            'agentFiles',
            'agents',
            'agentTurns',
            'chats',
            'chatTargets',
            'codexOAuth',
            'computerUse',
            'cortexAgentTools',
            'cortexDatabase',
            'cortexImportProcessors',
            'cortexJobs',
            'cortexModelAccess',
            'cortexWiki',
            'cron',
            'cronRuns',
            'embeddingModel',
            'events',
            'gateway',
            'knowledgebase',
            'logs',
            'memory',
            'mentions',
            'messages',
            'models',
            'sessionEvents',
            'sessions',
            'skillMaterialization',
            'skills',
            'status',
            'tasks',
            'tavernPlugin',
        ]);
        expect(getRuntimeCapability('embeddingModel')).toMatchObject({
            checkedAt: null,
            healthy: false,
            reason: 'Capability has not been checked yet.',
            state: 'unknown',
        });
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

    test('records Cortex agent tools as healthy when the managed plugin declares every tool', async () => {
        const pluginPath = path.join(runtimeRoot, 'cortex-plugin');
        await mkdir(pluginPath, { recursive: true });
        await writeFile(
            path.join(pluginPath, 'openclaw.plugin.json'),
            JSON.stringify({
                contracts: {
                    tools: [
                        'cortex_search',
                        'cortex_get_page',
                        'cortex_capture',
                        'cortex_edit',
                        'cortex_ingest',
                        'cortex_import',
                        'cortex_recall',
                        'cortex_list_backlinks',
                    ],
                },
            })
        );
        markManagedOpenClawGatewayReady();
        markCortexPluginInstalled(pluginPath);

        const [tools] = await refreshRuntimeCapabilities({
            ids: ['cortexAgentTools'],
        });

        expect(tools).toMatchObject({
            healthy: true,
            id: 'cortexAgentTools',
            metadata: {
                available: 8,
                expected: 8,
                pluginPath,
            },
            state: 'healthy',
        });
    });

    test('records Cortex agent tools unavailable when the managed plugin is incomplete', async () => {
        const pluginPath = path.join(runtimeRoot, 'incomplete-cortex-plugin');
        await mkdir(pluginPath, { recursive: true });
        await writeFile(
            path.join(pluginPath, 'openclaw.plugin.json'),
            JSON.stringify({ contracts: { tools: ['cortex_search'] } })
        );
        markManagedOpenClawGatewayReady();
        markCortexPluginInstalled(pluginPath);

        const [tools] = await refreshRuntimeCapabilities({
            ids: ['cortexAgentTools'],
        });

        expect(tools).toMatchObject({
            healthy: false,
            id: 'cortexAgentTools',
            metadata: {
                available: 1,
                expected: 8,
                missing: expect.arrayContaining(['cortex_capture', 'cortex_import']),
            },
            reason: 'Cortex plugin does not declare every expected tool.',
            state: 'unavailable',
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
                missing: expect.arrayContaining(['codex', 'openai', 'openrouter']),
                providers: ['codex', 'openai', 'openrouter'],
            },
            reason: 'Cortex model access is missing codex, openai, openrouter.',
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

    test('marks Gateway-backed cached capabilities degraded when managed Gateway is down', async () => {
        const capabilities = await refreshRuntimeCapabilities({
            ids: ['gateway', 'memory', 'models', 'skills'],
        });

        expect(
            capabilities.map((capability) => ({
                id: capability.id,
                state: capability.state,
            }))
        ).toEqual([
            { id: 'gateway', state: 'unavailable' },
            { id: 'memory', state: 'degraded' },
            { id: 'models', state: 'degraded' },
            { id: 'skills', state: 'degraded' },
        ]);
    });

    test('marks Gateway-backed capabilities healthy when managed Gateway is ready', async () => {
        markManagedOpenClawGatewayReady();

        const capabilities = await refreshRuntimeCapabilities({
            ids: ['gateway', 'memory', 'skills'],
        });

        expect(
            capabilities.map((capability) => ({
                id: capability.id,
                state: capability.state,
            }))
        ).toEqual([
            { id: 'gateway', state: 'healthy' },
            { id: 'memory', state: 'healthy' },
            { id: 'skills', state: 'healthy' },
        ]);
    });

    test('marks model inventory healthy when synced models exist', async () => {
        markManagedOpenClawGatewayReady();
        replaceStoredOpenClawModels({
            models: {
                models: [{ id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'openai' }],
                updatedAt: '2026-05-31T18:00:00.000Z',
            },
            syncedAt: '2026-05-31T18:00:00.000Z',
        });

        const [models] = await refreshRuntimeCapabilities({
            ids: ['models'],
        });

        expect(models).toMatchObject({
            healthy: true,
            id: 'models',
            metadata: {
                models: 1,
            },
            state: 'healthy',
        });
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
