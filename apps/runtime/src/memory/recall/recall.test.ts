import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeCapability, refreshRuntimeCapabilities } from '../../capabilities/store.ts';
import { closeDb, initTestDb } from '../../db/connection.ts';
import { ensureRuntimeSchema } from '../../db/schema.ts';
import { loadQmd } from './qmd-loader.ts';
import { recallMemoryPages, recallTurnMemory, searchMemoryPages } from './recall.ts';
import {
    getRecallProvisioningStatus,
    isRecallSemanticReady,
    refreshRecallIndex,
    resetRecallIndexForTesting,
    updateRecallIndex,
} from './recall-index.ts';

// Mirror the Runtime startup order: qmd must load before the first bun:sqlite
// Database exists so setCustomSQLite can swap in an extension-capable SQLite.
await loadQmd();

const embeddingModelCached = (() => {
    const modelsDir = path.join(homedir(), '.cache', 'qmd', 'models');
    return (
        existsSync(modelsDir) &&
        readdirSync(modelsDir).some((name) => name.includes('embeddinggemma'))
    );
})();

describe('memory recall', () => {
    let memoryRoot: string;
    let dataDir: string;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        memoryRoot = await mkdtemp(path.join(tmpdir(), 'tavern-recall-root-'));
        dataDir = await mkdtemp(path.join(tmpdir(), 'tavern-recall-data-'));
        await resetRecallIndexForTesting({
            dbPath: path.join(dataDir, 'memory-recall.sqlite'),
            memoryRoot,
        });
        await writeFile(
            path.join(memoryRoot, 'hamilton.md'),
            [
                '---',
                'summary: Hamilton show tickets and dates',
                'tags: [theater, calendar]',
                '---',
                '# Hamilton Show',
                'Zach has Hamilton tickets at the Orpheum. Google Calendar has the exact date.',
            ].join('\n')
        );
        await writeFile(
            path.join(memoryRoot, 'merchbase.md'),
            [
                '---',
                'summary: MerchBase Amazon merch sales business',
                '---',
                '# MerchBase',
                'MerchBase tracks Amazon merch sales, units, revenue, and royalties.',
            ].join('\n')
        );
    });

    afterEach(async () => {
        await resetRecallIndexForTesting();
        closeDb();
        await Promise.all([
            rm(memoryRoot, { force: true, recursive: true }),
            rm(dataDir, { force: true, recursive: true }),
        ]);
    });

    it('finds exact keywords through the lex lane without embeddings', async () => {
        await updateRecallIndex();
        const result = await searchMemoryPages({ query: 'MerchBase royalties' });

        expect(result.hits.map((hit) => hit.path)).toEqual(['memory/merchbase.md']);
        expect(result.hits[0]?.title).toBe('MerchBase');
        expect(result.hits[0]?.snippet).toContain('royalties');
    });

    it('returns no per-turn recall before embeddings are provisioned', async () => {
        expect(isRecallSemanticReady()).toBe(false);
        expect(await recallMemoryPages('when is my hamilton show?')).toEqual([]);
        expect(await recallTurnMemory('when is my hamilton show?')).toBeNull();
    });

    it('reports recall capability as degraded until provisioned', async () => {
        expect(getRecallProvisioningStatus()).toEqual({
            phase: 'idle',
            progress: null,
            reason: null,
        });

        const [capability] = await refreshRuntimeCapabilities({ ids: ['memoryRecall'] });
        expect(capability).toMatchObject({
            id: 'memoryRecall',
            reason: 'Recall has not been provisioned yet.',
            state: 'degraded',
        });
    });

    it.skipIf(!embeddingModelCached)(
        'reports recall capability healthy once embeddings are provisioned',
        async () => {
            await refreshRecallIndex();
            expect(getRecallProvisioningStatus().phase).toBe('ready');

            const [capability] = await refreshRuntimeCapabilities({ ids: ['memoryRecall'] });
            expect(capability).toMatchObject({
                id: 'memoryRecall',
                metadata: { phase: 'ready' },
                state: 'healthy',
            });
        }
    );

    it.skipIf(!embeddingModelCached)(
        'pushes the terminal ready state past the progress throttle',
        async () => {
            // Provisioning fires a 100%-progress push moments before ready;
            // the throttle must not swallow the trailing phase change or the
            // capability row freezes on a degraded 100% bar until the poll.
            await refreshRecallIndex();

            const deadline = Date.now() + 3000;
            let capability = getRuntimeCapability('memoryRecall');
            while (Date.now() < deadline && capability.state !== 'healthy') {
                await new Promise((resolve) => setTimeout(resolve, 25));
                capability = getRuntimeCapability('memoryRecall');
            }
            expect(capability).toMatchObject({
                metadata: { phase: 'ready' },
                state: 'healthy',
            });
        }
    );

    it.skipIf(!embeddingModelCached)(
        'reports drift when pages change behind the recall index',
        async () => {
            await refreshRecallIndex();

            await writeFile(
                path.join(memoryRoot, 'new-page.md'),
                ['---', 'summary: A page added after the last refresh', '---', '# New Page'].join(
                    '\n'
                )
            );

            const [capability] = await refreshRuntimeCapabilities({ ids: ['memoryRecall'] });
            expect(capability).toMatchObject({
                id: 'memoryRecall',
                metadata: { pendingEmbeddings: 1, totalPages: 3 },
                reason: 'Indexing 1 changed page for recall.',
                state: 'degraded',
            });
        }
    );

    it.skipIf(!embeddingModelCached)(
        'recalls pages for natural-language queries once embedded',
        async () => {
            await refreshRecallIndex();
            expect(isRecallSemanticReady()).toBe(true);

            const hits = await recallMemoryPages('when is my hamilton show?');
            expect(hits[0]?.path).toBe('memory/hamilton.md');
            expect(hits[0]?.score).toBeGreaterThanOrEqual(0.2);

            const recall = await recallTurnMemory(
                'when is [@Blippy](agent://agt_primary) seeing that theater thing?'
            );
            expect(recall?.block).toContain('Recalled Memory:');
            expect(recall?.block).toContain('memory/hamilton.md');
            expect(recall?.hits[0]?.path).toBe('memory/hamilton.md');
        }
    );

    it.skipIf(!embeddingModelCached)(
        'omits recall for queries no page clears the relevance floor on',
        async () => {
            await refreshRecallIndex();
            const recall = await recallTurnMemory('completely unrelated quantum badger festival');
            expect(recall).toBeNull();
        }
    );
});
