import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureCortexSchema } from '../cortex/schema';
import { saveCortexSettings } from '../cortex/settings';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import {
    markManagedOpenClawGatewayReady,
    markManagedOpenClawGatewayStopped,
} from '../openclaw/state';
import { replaceStoredOpenClawModels } from '../tavern/openclaw-snapshots-store';
import { getRuntimeCapability, listRuntimeCapabilities, refreshRuntimeCapabilities } from './store';

describe('Runtime capabilities store', () => {
    let runtimeRoot: string;
    const originalPath = process.env.PATH;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-capabilities-'));
        const binPath = path.join(runtimeRoot, 'bin');
        await mkdir(binPath, { recursive: true });
        await writeFile(path.join(binPath, 'codex'), '#!/bin/sh\necho codex-test\n', {
            mode: 0o755,
        });
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
        process.env.PATH = binPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = path.join(runtimeRoot, 'cortex-wiki');
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureCortexSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        markManagedOpenClawGatewayStopped();
        closeDb();
        process.env.CODEX_HOME = undefined;
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
            'cortexDatabase',
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
        saveCortexSettings(getDb(), {
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });

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
