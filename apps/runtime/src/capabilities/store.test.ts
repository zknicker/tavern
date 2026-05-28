import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureCortexSchema } from '../cortex/schema';
import { saveCortexSettings } from '../cortex/settings';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { getRuntimeCapability, listRuntimeCapabilities, refreshRuntimeCapabilities } from './store';

describe('Runtime capabilities store', () => {
    beforeEach(() => {
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureCortexSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        closeDb();
    });

    test('lists expected Runtime capabilities before the first refresh', () => {
        const capabilities = listRuntimeCapabilities();

        expect(capabilities.map((capability) => capability.id)).toEqual([
            'agentFiles',
            'agents',
            'agentTurns',
            'chats',
            'chatTargets',
            'computerUse',
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
