import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { getCortexEmbeddingConfig, getCortexSettings, saveCortexSettings } from './settings';

describe('Cortex settings', () => {
    beforeEach(async () => {
        const runtimeDb = initTestDb();
        ensureRuntimeSchema(runtimeDb);
        process.env.OPENAI_API_KEY = '';
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        closeDb();
        await closeCortexDb();
        process.env.OPENAI_API_KEY = undefined;
    });

    test('stores legacy embedding API key saves in Tavern Vault', async () => {
        const db = getCortexDb();

        const settings = await saveCortexSettings(db, {
            embedding: {
                apiKey: 'sk-test-cortex-000000000000',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });

        expect(settings.embedding.apiKeyConfigured).toBe(true);
        expect((await getCortexSettings(db)).embedding.apiKeyConfigured).toBe(true);
        expect((await getCortexEmbeddingConfig(db)).apiKey).toBe('sk-test-cortex-000000000000');
    });
});
