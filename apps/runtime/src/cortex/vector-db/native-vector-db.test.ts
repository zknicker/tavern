import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createCortexVectorDatabase } from './native-vector-db';

describe('Cortex native vector database', () => {
    let vectorPath: string;

    beforeEach(async () => {
        vectorPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-vector-'));
        process.env.TAVERN_CORTEX_VECTOR_PATH = vectorPath;
    });

    afterEach(async () => {
        process.env.TAVERN_CORTEX_VECTOR_PATH = undefined;
        await rm(vectorPath, { force: true, recursive: true });
    });

    test('indexes and searches chunk vectors through the generic boundary', async () => {
        const vectorDatabase = createCortexVectorDatabase();

        await vectorDatabase.upsert([
            {
                chunkId: 'chunk-1',
                dimensions: 3,
                model: 'test-model',
                pageId: 'page-1',
                provider: 'test-provider',
                section: 'compiled_truth',
                sourceId: null,
                textHash: 'hash-1',
                vector: [1, 0, 0],
            },
            {
                chunkId: 'chunk-2',
                dimensions: 3,
                model: 'test-model',
                pageId: 'page-2',
                provider: 'test-provider',
                section: 'compiled_truth',
                sourceId: null,
                textHash: 'hash-2',
                vector: [0, 1, 0],
            },
        ]);

        await expect(vectorDatabase.status()).resolves.toMatchObject({
            backend: 'lancedb',
            degradedReason: null,
            indexedCount: 2,
        });

        const hits = await vectorDatabase.search({
            dimensions: 3,
            limit: 1,
            model: 'test-model',
            provider: 'test-provider',
            vector: [1, 0, 0],
        });

        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({
            chunkId: 'chunk-1',
            pageId: 'page-1',
            textHash: 'hash-1',
        });
    });
});
