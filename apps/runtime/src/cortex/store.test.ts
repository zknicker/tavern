import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { getActiveCortexSchema } from './cortex-schema';
import { type CortexDatabase, closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { applyDreamProposal } from './dream-apply';
import { editCortexPage } from './edit';
import { ingestCortexSource } from './ingest';
import { runCortexJob } from './jobs';
import { detectCortexIssues } from './lint';
import { listCortexPageVersions } from './page-versions';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    traverseCortexGraph,
} from './read';
import { revertCortexPage } from './revert';
import {
    addCortexSchemaTerm,
    deleteUnusedCortexSchemaAddition,
    listCortexSchemaAdditions,
} from './schema-additions';
import { saveCortexSettings } from './settings';
import { syncCortexMarkdown } from './sync';
import { captureCortex } from './write';

describe('Cortex PGLite storage', () => {
    let wikiPath: string;

    beforeEach(async () => {
        wikiPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-wiki-'));
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(wikiPath, 'empty-codex-home');
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.OPENAI_API_KEY = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(wikiPath, { force: true, recursive: true });
    });

    test('captures a source-backed page with claims, chunks, links, and audit', async () => {
        const store = createCortexHarness();
        const result = await store.capture({
            content: 'Tavern Cortex stores durable memory. It links to [[openclaw]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                chatId: 'chat-1',
                messageId: 'msg-1',
            },
            tags: ['memory'],
            title: 'Tavern Cortex',
            type: 'project',
        });

        expect(result.page.slug).toBe('tavern-cortex');
        expect(result.page.claims).toHaveLength(2);
        expect(result.page.links[0]).toMatchObject({
            targetPageId: null,
            targetSlug: 'openclaw',
        });
        expect((await store.listPages()).pages[0]?.links[0]).toMatchObject({
            targetSlug: 'openclaw',
        });
        expect(await store.status()).toMatchObject({
            auditCount: 1,
            captureCount: 1,
            chunkCount: 2,
            claimCount: 2,
            encoding: {
                currentCount: 0,
                staleCount: 0,
                totalCount: 0,
            },
            linkCount: 1,
            pageCount: 1,
        });
    });

    test('replayed capture returns existing output without duplicating timeline evidence', async () => {
        const store = createCortexHarness();
        const input = {
            content: 'One stable fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user' as const,
                messageId: 'msg-1',
            },
            tags: [],
            title: 'Stable Fact',
            type: 'fact' as const,
        };

        const first = await store.capture(input);
        const second = await store.capture(input);

        expect(second.page.id).toBe(first.page.id);
        expect(second.auditId).toBe(first.auditId);
        expect((await store.getPage('stable-fact'))?.timeline).toHaveLength(1);
        expect(await countRows(getCortexDb(), 'cortex_audit_events')).toBe(1);
    });

    test('agent-added capture page types extend the active schema', async () => {
        const store = createCortexHarness();
        const first = await store.capture({
            content: 'A podcast episode taught Zach a better automation workflow.',
            source: {
                actorId: 'agent-1',
                actorKind: 'agent',
                chatId: 'chat-1',
                messageId: 'msg-1',
            },
            tags: ['podcast'],
            title: 'Podcast Automation Lesson',
            type: 'podcast-episode',
        });
        await store.capture({
            content: 'A second capture uses the same schema addition.',
            source: {
                actorId: 'agent-1',
                actorKind: 'agent',
                chatId: 'chat-1',
                messageId: 'msg-2',
            },
            tags: ['podcast'],
            title: 'Second Podcast Automation Lesson',
            type: 'podcast-episode',
        });

        expect(first.page).toMatchObject({
            slug: 'podcast-automation-lesson',
            type: 'podcast-episode',
        });
        expect((await store.getSchema()).pageTypes).toContain('podcast-episode');
        expect((await store.listSchemaAdditions()).additions).toEqual([
            expect.objectContaining({
                example: expect.objectContaining({
                    title: 'Podcast Automation Lesson',
                }),
                kind: 'page-type',
                name: 'podcast-episode',
                usageCount: 2,
            }),
        ]);
    });

    test('agent-added edit page and link types extend the active schema', async () => {
        const store = createCortexHarness();
        const result = await store.edit({
            action: 'upsert',
            body: 'An experimental memory type can still be captured.',
            links: [{ linkKind: 'sourced_from', targetSlug: 'source-note' }],
            source: {
                actorId: 'agent-1',
                actorKind: 'agent',
            },
            title: 'Experimental Memory',
            type: 'research-artifact',
        });
        const schema = await store.getSchema();
        const additions = await store.listSchemaAdditions();

        expect(result.pages[0]).toMatchObject({
            slug: 'experimental-memory',
            type: 'research-artifact',
        });
        expect(result.pages[0]?.links[0]).toMatchObject({
            linkKind: 'sourced_from',
            targetSlug: 'source-note',
        });
        expect(schema.pageTypes).toContain('research-artifact');
        expect(schema.linkTypes.map((type) => type.name)).toContain('sourced_from');
        expect(additions.additions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'page-type',
                    name: 'research-artifact',
                    usageCount: 1,
                }),
                expect.objectContaining({
                    kind: 'link-type',
                    name: 'sourced_from',
                    usageCount: 1,
                }),
            ])
        );
    });

    test('dream-added page and link types extend the active schema', async () => {
        const store = createCortexHarness();

        await applyDreamProposal(getCortexDb(), {
            model: 'codex/gpt-5.5',
            outputHash: 'output-hash',
            promptHash: 'prompt-hash',
            proposal: {
                citations: [],
                noops: [],
                observations: [],
                pageWrites: [
                    {
                        compiledTruth: 'A new content shape from dream.',
                        title: 'Dream Content Shape',
                        type: 'content-brief',
                    },
                ],
                relationships: [
                    {
                        fromSlug: 'dream-content-shape',
                        linkKind: 'summarizes_source',
                        targetSlug: 'source-thread',
                    },
                ],
                timelineEntries: [],
                warnings: [],
            },
            sourceRange: {
                captureKey: 'dream-test',
                messageIds: ['msg-dream'],
                sourceHash: 'source-hash',
                sourceRefs: [{ id: 'msg-dream', kind: 'message', locator: 'dream://msg-dream' }],
                text: 'A dream test source.',
            },
        });

        expect(await store.getPage('dream-content-shape')).toMatchObject({
            type: 'content-brief',
        });
        expect((await store.getSchema()).pageTypes).toContain('content-brief');
        expect((await store.listSchemaAdditions()).additions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'page-type',
                    name: 'content-brief',
                    usageCount: 1,
                }),
                expect.objectContaining({
                    kind: 'link-type',
                    name: 'summarizes_source',
                    usageCount: 1,
                }),
            ])
        );
    });

    test('deletes unused schema additions but preserves used additions', async () => {
        const store = createCortexHarness();
        await store.capture({
            content: 'A used dynamic type.',
            source: {
                actorId: 'agent-1',
                actorKind: 'agent',
            },
            tags: [],
            title: 'Used Dynamic Type',
            type: 'used-dynamic-type',
        });
        const used = (await store.listSchemaAdditions()).additions.find(
            (addition) => addition.name === 'used-dynamic-type'
        );

        expect(used).toBeTruthy();
        await expect(store.deleteSchemaAddition(used?.id ?? '')).rejects.toThrow(
            'schema addition is still used'
        );

        const unused = await store.addSchemaAddition({
            example: { title: 'Unused' },
            kind: 'page-type',
            name: 'unused-dynamic-type',
            reason: 'Test cleanup.',
            sourceRefs: [],
        });
        await store.deleteSchemaAddition(unused.id);

        expect(
            (await store.listSchemaAdditions()).additions.map((addition) => addition.name)
        ).not.toContain('unused-dynamic-type');
    });

    test('missing embeddings do not block lexical recall', async () => {
        const store = createCortexHarness();

        await store.capture({
            content: 'Lexical fallback survives stale encodings.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Stale Encoding',
            type: 'fact',
        });

        const result = await store.recall({ limit: 5, query: 'lexical fallback' });

        expect(result.hits[0]?.page.slug).toBe('stale-encoding');
        expect((await store.status()).encoding).toMatchObject({
            currentCount: 0,
            staleCount: 0,
            totalCount: 0,
        });
    });

    test('ingests source-backed text into a searchable Cortex page', async () => {
        const store = createCortexHarness();
        const result = await store.ingest({
            content: 'A shortcut idea should become durable source-backed Cortex material.',
            kind: 'article',
            locator: 'https://example.com/shortcut-idea',
            metadata: { author: 'Example' },
            tags: ['ingest'],
            title: 'Shortcut Idea',
            type: 'source',
        });

        expect(result.sourceRef).toMatchObject({
            kind: 'article',
            locator: 'https://example.com/shortcut-idea',
        });
        expect(result.page).toMatchObject({
            slug: 'shortcut-idea',
            sourceRefs: [expect.objectContaining({ kind: 'article' })],
            tags: ['ingest'],
        });
        expect(await store.status()).toMatchObject({
            sourceCount: 2,
        });
        expect((await store.recall({ query: 'shortcut idea' })).hits[0]).toMatchObject({
            page: {
                slug: 'shortcut-idea',
            },
        });
    });

    test('records page versions and reverts through the normal edit path', async () => {
        const store = createCortexHarness();
        await store.edit({
            action: 'upsert',
            body: 'First version body.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            title: 'Versioned Page',
            type: 'note',
        });
        await store.edit({
            action: 'upsert',
            body: 'Second version body.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            title: 'Versioned Page',
            type: 'note',
        });

        const history = await store.history('versioned-page');
        expect(history.versions.map((version) => version.versionNumber)).toEqual([2, 1]);

        await store.revert('versioned-page', String(history.versions.at(-1)?.versionNumber ?? 1));

        expect(await store.getPage('versioned-page')).toMatchObject({
            body: 'First version body.',
        });
        expect((await store.history('versioned-page')).versions[0]).toMatchObject({
            versionNumber: 3,
        });
    });

    test('generate-embeddings writes pgvector rows into Cortex PGLite', async () => {
        const store = createCortexHarness();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        data: [{ embedding: Array.from({ length: 1536 }, () => 0.1) }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );

        process.env.OPENAI_API_KEY = 'sk-test-cortex-000000000000';
        await store.capture({
            content: 'Semantic embedding fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Semantic Embedding',
            type: 'fact',
        });
        expect((await store.getPage('semantic-embedding'))?.indexing).toMatchObject({
            chunkCount: 2,
            currentEmbeddingCount: 0,
            missingEmbeddingCount: 2,
            staleEmbeddingCount: 0,
            status: 'needs-indexing',
        });

        const run = await store.runJob('generate-embeddings', { stale: true });

        expect(run.summary).toContain('Generated embeddings for 2 Cortex chunk(s)');
        expect((await store.getPage('semantic-embedding'))?.indexing).toMatchObject({
            chunkCount: 2,
            currentEmbeddingCount: 2,
            missingEmbeddingCount: 0,
            staleEmbeddingCount: 0,
            status: 'ready',
        });
        expect((await store.status()).encoding).toMatchObject({
            currentCount: 2,
            dimensions: 1536,
            model: 'text-embedding-3-small',
            provider: 'openai',
            totalCount: 2,
        });
        expect((await store.status()).vectorIndex).toMatchObject({
            backend: 'pglite-vector',
            degradedReason: null,
            indexedCount: 2,
            table: 'cortex_encodings',
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    test('generate-embeddings rejects full regeneration requests', async () => {
        const store = createCortexHarness();
        await expect(store.runJob('generate-embeddings', { stale: false })).rejects.toThrow(
            'stale-only embedding generation'
        );
    });

    test('settings normalize model providers Cortex cannot run', async () => {
        const store = createCortexHarness();
        const settings = await store.saveSettings({
            embedding: {
                model: 'text-embedding-3-small',
                modelRef: 'openai/text-embedding-3-small',
                provider: 'openai',
            },
            models: {
                chatIngestion: 'openrouter/google/gemini-2.5-flash-lite',
                dream: 'openrouter/google/gemini-2.5-flash-lite',
                ocr: 'codex/gpt-5.5',
                queryExpansion: 'codex/gpt-5.5',
            },
        });

        expect(settings.models).toMatchObject({
            chatIngestion: 'codex/gpt-5.5',
            dream: 'codex/gpt-5.5',
            ocr: 'openai/gpt-4o-mini',
            queryExpansion: 'openrouter/google/gemini-2.5-flash-lite',
        });
    });

    test('repair-derived-state refreshes deterministic links and chunks', async () => {
        const store = createCortexHarness();
        await store.capture({
            content: 'This page points at [[first-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Link Test',
            type: 'note',
        });

        const run = await store.runJob('repair-derived-state');

        expect(run.status).toBe('success');
        expect(run.summary).toContain('Repaired derived Cortex links and chunks');
        expect((await store.listBacklinks('first-target')).links).toHaveLength(1);
    });

    test('graph traversal accepts page ids as roots', async () => {
        const store = createCortexHarness();
        const source = await store.capture({
            content: 'This page points at [[graph-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Graph Source',
            type: 'note',
        });
        await store.capture({
            content: 'Graph target body.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Graph Target',
            type: 'note',
        });

        const graph = await store.traverseGraph({
            depth: 1,
            root: source.page.id,
        });

        expect(graph.root).toBe(source.page.id);
        expect(graph.paths).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    depth: 1,
                    fromSlug: 'graph-source',
                    toSlug: 'graph-target',
                }),
            ])
        );
    });

    test('repair-derived-state dry run reports repairs without mutating derived state', async () => {
        const store = createCortexHarness();
        await store.capture({
            content: 'This page points at [[dry-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Dry Run Link Test',
            type: 'note',
        });
        await getCortexDb().prepare('DELETE FROM cortex_chunks').run();
        await getCortexDb().prepare('DELETE FROM cortex_links').run();

        const dryRun = await store.runJob('repair-derived-state', { dryRun: true });

        expect(dryRun.status).toBe('success');
        expect(dryRun.summary).toContain('Dry run: would repair derived Cortex links and chunks');
        expect(await countRows(getCortexDb(), 'cortex_chunks')).toBe(0);
        expect(await countRows(getCortexDb(), 'cortex_links')).toBe(0);

        const run = await store.runJob('repair-derived-state');

        expect(run.summary).toContain('Repaired derived Cortex links and chunks');
        expect((await store.listBacklinks('dry-target')).links).toHaveLength(1);
        expect(await countRows(getCortexDb(), 'cortex_chunks')).toBeGreaterThan(0);
    });

    test('status recommends actions from PGLite lint findings', async () => {
        const store = createCortexHarness();
        await store.capture({
            content: 'Health check links to [[missing-health-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Health Recommendation',
            type: 'note',
        });
        await getCortexDb().prepare('DELETE FROM cortex_chunks').run();

        const status = await store.status();

        expect(status.recommendations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'run-cortex-repair-derived-state',
                    count: 1,
                    kind: 'unresolved-link',
                    severity: 'warning',
                }),
                expect.objectContaining({
                    action: 'run-cortex-repair-derived-state',
                    count: 1,
                    kind: 'missing-chunks',
                    severity: 'warning',
                }),
            ])
        );
    });

    test('lint flags inbound orphans, invalid page types, and missing cross references', async () => {
        const store = createCortexHarness();
        const target = await store.capture({
            content: 'Link target content.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Link Target',
            type: 'note',
        });
        const source = await store.capture({
            content: 'Source page links to [[Link Target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Outbound Only Source',
            type: 'note',
        });
        await store.capture({
            content: 'This durable note mentions Link Target but lacks a wiki link.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Cross Reference Candidate',
            type: 'note',
        });
        await getCortexDb()
            .prepare("UPDATE cortex_pages SET type = 'unexpected-type' WHERE id = $id")
            .run({ id: source.page.id });

        const issues = await detectCortexIssues(getCortexDb());

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'orphan-page',
                    pageId: source.page.id,
                    summary: expect.stringContaining('zero inbound'),
                }),
                expect.objectContaining({
                    kind: 'invalid-page-type',
                    pageId: source.page.id,
                    summary: expect.stringContaining('unexpected-type'),
                }),
                expect.objectContaining({
                    kind: 'missing-cross-reference',
                    summary: expect.stringContaining('Link Target'),
                }),
            ])
        );
        expect(issues).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'orphan-page',
                    pageId: target.page.id,
                }),
            ])
        );
    });

    test('status routes stale embedding recommendations to the embedding job', async () => {
        const store = createCortexHarness();
        process.env.OPENAI_API_KEY = 'sk-test-cortex-000000000000';
        await store.capture({
            content: 'Stale embedding recommendation content.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Stale Embedding Recommendation',
            type: 'note',
        });
        const chunk = await getCortexDb()
            .prepare('SELECT id FROM cortex_chunks LIMIT 1')
            .get<{ id: string }>();
        expect(chunk).toBeTruthy();
        await getCortexDb()
            .prepare(
                `INSERT INTO cortex_encodings
                 (id, chunk_id, provider, model, dimensions, embedding, input_text_hash, embedded_at)
                 VALUES ('ctxe_stale_recommendation', $chunkId, 'openai', 'text-embedding-3-small', 1536, $embedding, 'old-hash', $embeddedAt)`
            )
            .run({
                chunkId: chunk?.id,
                embeddedAt: new Date().toISOString(),
                embedding: vectorLiteral(Array.from({ length: 1536 }, () => 0.2)),
            });

        const status = await store.status();

        expect(status.recommendations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'run-cortex-generate-embeddings',
                    kind: 'stale-embedding',
                    severity: 'warning',
                }),
            ])
        );
    });

    test('sync projects markdown pages into PGLite', async () => {
        await mkdir(path.join(wikiPath, 'project'), { recursive: true });
        await writeFile(
            path.join(wikiPath, 'project/foo.md'),
            `---
id: ctxp_markdown_project
title: Project Foo
type: project
status: active
tags:
  - docs
source_refs: []
updated_at: 2026-06-04T00:00:00.000Z
---

Markdown compiled truth linking to [[project/bar]].

## Timeline

- 2026-06-04T00:00:00.000Z - Imported markdown page.
`
        );

        const result = await syncCortexMarkdown(getCortexDb());
        const page = await getCortexPage(getCortexDb(), 'project/foo');

        expect(result.pagesSynced).toBe(1);
        expect(page).toMatchObject({
            slug: 'project/foo',
            title: 'Project Foo',
            type: 'project',
        });
        expect(page?.links[0]).toMatchObject({
            targetSlug: 'project/bar',
        });
    });
});

function createCortexHarness() {
    return {
        addSchemaAddition: (input: Parameters<typeof addCortexSchemaTerm>[1]) =>
            addCortexSchemaTerm(getCortexDb(), input),
        capture: (input: Parameters<typeof captureCortex>[1]) =>
            captureCortex(getCortexDb(), input),
        deleteSchemaAddition: (id: string) => deleteUnusedCortexSchemaAddition(getCortexDb(), id),
        edit: (input: Parameters<typeof editCortexPage>[1]) => editCortexPage(getCortexDb(), input),
        getSchema: () => getActiveCortexSchema(getCortexDb()),
        history: (slugOrId: string) => listCortexPageVersions(getCortexDb(), slugOrId),
        ingest: (input: Parameters<typeof ingestCortexSource>[1]) =>
            ingestCortexSource(getCortexDb(), input),
        getPage: (slugOrId: string) => getCortexPage(getCortexDb(), slugOrId),
        listBacklinks: (target: string) => listCortexBacklinks(getCortexDb(), target),
        listPages: () => listCortexPages(getCortexDb()),
        listSchemaAdditions: () => listCortexSchemaAdditions(getCortexDb()),
        recall: (input: Parameters<typeof recallCortex>[1]) => recallCortex(getCortexDb(), input),
        traverseGraph: (input: Parameters<typeof traverseCortexGraph>[1]) =>
            traverseCortexGraph(getCortexDb(), input),
        revert: (slugOrId: string, versionId: string) =>
            revertCortexPage(getCortexDb(), slugOrId, {
                source: {
                    actorId: 'user-1',
                    actorKind: 'user',
                },
                versionId,
            }),
        runJob: (
            job: Parameters<typeof runCortexJob>[1],
            options?: Parameters<typeof runCortexJob>[2]
        ) => runCortexJob(getCortexDb(), job, options),
        saveSettings: (input: Parameters<typeof saveCortexSettings>[1]) =>
            saveCortexSettings(getCortexDb(), input),
        status: () => getCortexStatus(getCortexDb()),
    };
}

async function countRows(db: CortexDatabase, table: string): Promise<number> {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<{ count: number }>();
    return row?.count ?? 0;
}

function vectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
}
