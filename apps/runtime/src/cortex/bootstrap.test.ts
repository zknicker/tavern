import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { getActiveCortexSchemaRecord } from './cortex-schema';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { getCortexSettings, saveCortexSettings } from './settings';

describe('Cortex runtime bootstrap', () => {
    beforeEach(async () => {
        await initTestCortexDb();
    });

    afterEach(async () => {
        await closeCortexDb();
    });

    test('seeds managed schema, filesystem, and default settings', async () => {
        const db = getCortexDb();

        await ensureCortexRuntimeBootstrap(db);

        expect(await getActiveCortexSchemaRecord(db)).toMatchObject({
            id: 'ctxschema_default',
            schema: {
                name: 'cortex-base',
            },
            status: 'active',
        });
        expect(await getCortexSettings(db)).toMatchObject({
            embedding: {
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
            recall: {
                mode: 'balanced',
            },
        });
    });

    test('does not overwrite operator settings on later startup', async () => {
        const db = getCortexDb();
        await ensureCortexRuntimeBootstrap(db);
        await saveCortexSettings(db, {
            embedding: {
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
            recall: {
                mode: 'tokenmax',
            },
        });

        await ensureCortexRuntimeBootstrap(db);

        expect(await getCortexSettings(db)).toMatchObject({
            embedding: {
                apiKey: null,
                model: 'text-embedding-3-small',
            },
            recall: {
                mode: 'tokenmax',
            },
        });
    });

    test('rejects embedding models that do not match the managed vector dimensions', async () => {
        const db = getCortexDb();
        await ensureCortexRuntimeBootstrap(db);

        await expect(
            saveCortexSettings(db, {
                embedding: {
                    model: 'text-embedding-3-large',
                    provider: 'openai',
                },
            })
        ).rejects.toThrow('initialized for 1536-dimension embeddings');
    });
});
