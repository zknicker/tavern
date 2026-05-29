import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { Database } from '../db/sqlite';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { getActiveCortexSchemaRecord, saveActiveCortexSchema } from './cortex-schema';
import { applyDreamProposal } from './dream-apply';
import { editCortexPage } from './edit';
import { runCortexJob } from './jobs';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
} from './read';
import { ensureCortexSchema } from './schema';
import { saveCortexSettings } from './settings';
import { sourceRefFromMessage as sourceRefFromSignalMessage } from './signal-cursor';
import { MemoryVectorDatabase } from './vector-db/memory';
import { captureCortex } from './write';

describe('Cortex runtime storage', () => {
    let wikiPath: string;

    beforeEach(async () => {
        wikiPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-wiki-'));
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(wikiPath, 'empty-codex-home');
        process.env.TAVERN_CORTEX_DREAM_MODEL = undefined;
        process.env.TAVERN_CORTEX_SIGNAL_MODEL = undefined;
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        ensureCortexSchema(db);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        closeDb();
        process.env.CODEX_HOME = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        process.env.TAVERN_CORTEX_DREAM_MODEL = undefined;
        process.env.TAVERN_CORTEX_SIGNAL_MODEL = undefined;
        await rm(wikiPath, { force: true, recursive: true });
    });

    test('captures a source-backed page with claims chunks encodings and audit', async () => {
        const store = createCortexHarness();
        const result = store.capture({
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
            targetSlug: 'openclaw',
            targetPageId: null,
        });
        expect(store.listPages().pages[0]?.links[0]).toMatchObject({
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
            sourceCount: 2,
        });
    });

    test('migrates existing Cortex claim tables for superseded claims', () => {
        const db = new Database(':memory:');
        try {
            db.exec(`
                CREATE TABLE cortex_claims (
                  id TEXT PRIMARY KEY,
                  page_id TEXT NOT NULL,
                  subject TEXT NOT NULL,
                  predicate TEXT NOT NULL,
                  value TEXT NOT NULL,
                  confidence REAL,
                  status TEXT NOT NULL,
                  source_refs_json TEXT NOT NULL DEFAULT '[]',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
            `);

            ensureCortexSchema(db);

            const columns = (
                db.prepare('PRAGMA table_info(cortex_claims)').all() as Array<{ name: string }>
            ).map((column) => column.name);
            expect(columns).toContain('supersedes_claim_id');
        } finally {
            db.close();
        }
    });

    test('replayed capture returns existing output without duplicating timeline evidence', async () => {
        const store = createCortexHarness();
        const db = getDb();
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

        const first = store.capture(input);
        const second = store.capture(input);

        expect(second.page.id).toBe(first.page.id);
        expect(second.auditId).toBe(first.auditId);
        expect(store.getPage('stable-fact')?.timeline).toHaveLength(1);
        expect(countRows(db, 'cortex_captures')).toBe(1);
        expect(countRows(db, 'cortex_audit_events')).toBe(1);
        expect(countRows(db, 'cortex_timeline_entries')).toBe(1);
        expect(countRows(db, 'cortex_claims')).toBe(1);
    });

    test('same source boundary updates the page without creating a second capture record', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const source = {
            actorId: 'user-1',
            actorKind: 'user' as const,
            messageId: 'msg-1',
        };

        const first = store.capture({
            content: 'Initial fact.',
            source,
            tags: [],
            title: 'Mutable Fact',
            type: 'fact',
        });
        const second = store.capture({
            content: 'Updated fact.',
            source,
            tags: [],
            title: 'Mutable Fact',
            type: 'fact',
        });

        expect(second.page.id).toBe(first.page.id);
        expect(second.auditId).not.toBe(first.auditId);
        expect(second.page.body).toBe('Updated fact.');
        expect(second.page.claims[0]?.value).toBe('Updated fact.');
        expect(store.getPage('mutable-fact')?.timeline).toHaveLength(2);
        expect(countRows(db, 'cortex_captures')).toBe(1);
        expect(readFirstCaptureAttemptCount(db)).toBe(2);
        expect(countRows(db, 'cortex_audit_events')).toBe(2);
    });

    test('same content recapture updates changed tags', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const source = {
            actorId: 'user-1',
            actorKind: 'user' as const,
            messageId: 'msg-1',
        };

        const first = store.capture({
            content: 'Tagged fact.',
            source,
            tags: ['old'],
            title: 'Tagged Fact',
            type: 'fact',
        });
        const second = store.capture({
            content: 'Tagged fact.',
            source,
            tags: ['current'],
            title: 'Tagged Fact',
            type: 'fact',
        });

        expect(second.page.id).toBe(first.page.id);
        expect(second.auditId).not.toBe(first.auditId);
        expect(store.getPage('tagged-fact')?.tags).toEqual(['current']);
        expect(countRows(db, 'cortex_captures')).toBe(1);
        expect(readFirstCaptureAttemptCount(db)).toBe(2);
    });

    test('markdown sync preserves per-timeline-entry source refs', async () => {
        const store = createCortexHarness();
        store.capture({
            content: 'First sourced fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                messageId: 'msg-source-1',
            },
            tags: [],
            title: 'Sourced Timeline',
            type: 'fact',
        });
        store.capture({
            content: 'Second sourced fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                messageId: 'msg-source-2',
            },
            tags: [],
            title: 'Sourced Timeline',
            type: 'fact',
        });

        await store.runJob('sync');

        const timeline = store.getPage('sourced-timeline')?.timeline ?? [];
        expect(timeline).toHaveLength(2);
        expect(timeline[0]?.sourceRefs).toEqual([
            expect.objectContaining({ locator: 'msg-source-1' }),
        ]);
        expect(timeline[1]?.sourceRefs).toEqual([
            expect.objectContaining({ locator: 'msg-source-2' }),
        ]);
    });

    test('markdown sync registers the file source alongside authored source refs', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'Canonical markdown should remain traceable to its file.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                messageId: 'msg-file-provenance',
            },
            tags: [],
            title: 'File Source Provenance',
            type: 'fact',
        });
        const filePath = path.join(wikiPath, 'file-source-provenance.md');

        await store.runJob('sync');

        expect(
            db
                .prepare('SELECT kind, locator FROM cortex_sources WHERE kind = ? AND locator = ?')
                .get('file', filePath)
        ).toMatchObject({ kind: 'file', locator: filePath });
        const pageRow = db
            .prepare('SELECT source_refs_json FROM cortex_pages WHERE slug = ?')
            .get('file-source-provenance') as { source_refs_json: string };
        expect(JSON.parse(pageRow.source_refs_json)).toEqual([
            expect.objectContaining({ kind: 'user', locator: 'msg-file-provenance' }),
        ]);
    });

    test('recall returns matching pages and writes audit', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'The OpenClaw prompt-time layer uses native context management.',
            source: {
                actorId: 'runtime',
                actorKind: 'runtime',
            },
            tags: ['openclaw'],
            title: 'OpenClaw Memory',
            type: 'fact',
        });

        const result = await store.recall({ limit: 5, query: 'native context memory' });

        expect(result.auditId).toMatch(/^ctxa_/u);
        expect(result.mode).toBe('balanced');
        expect(result.requestedMode).toBeNull();
        expect(result.hits[0]?.page.slug).toBe('openclaw-memory');
        expect(result.hits[0]?.evidence[0]).toMatchObject({
            kind: 'runtime',
            locator: 'runtime',
        });
        expect(readAuditMetadata(db, result.auditId)).toMatchObject({
            effectiveMode: 'balanced',
            expandedQueryCount: 0,
            payload: {
                estimatedTokens: expect.any(Number),
                returnedChars: expect.any(Number),
                returnedPageIds: [expect.any(String)],
            },
            requestedMode: null,
            resultCount: 1,
            vectorDegradedReason: null,
        });
        expect((await store.status()).lastRecallAt).not.toBeNull();
    });

    test('recall mode can be configured globally or overridden per call', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.saveSettings({
            embedding: {
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
            recall: {
                mode: 'conservative',
            },
        });
        store.capture({
            content: 'Recall mode settings choose default retrieval breadth.',
            source: {
                actorId: 'runtime',
                actorKind: 'runtime',
            },
            tags: [],
            title: 'Recall Mode',
            type: 'fact',
        });

        const configured = await store.recall({ query: 'retrieval breadth' });
        const overridden = await store.recall({ mode: 'tokenmax', query: 'retrieval breadth' });

        expect(configured.mode).toBe('conservative');
        expect(configured.requestedMode).toBeNull();
        expect(overridden.mode).toBe('tokenmax');
        expect(overridden.requestedMode).toBe('tokenmax');
        expect(readAuditMetadata(db, overridden.auditId)).toMatchObject({
            effectiveMode: 'tokenmax',
            requestedMode: 'tokenmax',
        });
    });

    test('tokenmax recall expands queries and ranks graph neighbors', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'Print on demand roadmap depends on [[campaign-qa-checklist]].',
            source: {
                actorId: 'runtime',
                actorKind: 'runtime',
            },
            tags: ['pod'],
            title: 'POD Roadmap',
            type: 'project',
        });
        store.capture({
            content: 'Preflight checks image bleed, catalog margins, and mockup consistency.',
            source: {
                actorId: 'runtime',
                actorKind: 'runtime',
            },
            tags: ['quality'],
            title: 'Campaign QA Checklist',
            type: 'task',
        });

        const result = await store.recall({
            limit: 5,
            mode: 'tokenmax',
            query: 'print on demand roadmap',
        });

        expect(result.hits.map((hit) => hit.page.slug)).toEqual(
            expect.arrayContaining(['pod-roadmap', 'campaign-qa-checklist'])
        );
        expect(readAuditMetadata(db, result.auditId)).toMatchObject({
            effectiveMode: 'tokenmax',
            expandedQueries: expect.arrayContaining([expect.stringContaining('campaign')]),
        });
    });

    test('participant-scoped recall does not merge same-name participants', async () => {
        const store = createCortexHarness();

        store.capture({
            content: 'Jordan prefers short morning summaries.',
            source: {
                actorId: 'discord:workspace:user-a',
                actorKind: 'user',
                participantId: 'participant-a',
            },
            tags: ['person'],
            title: 'Jordan Preference A',
            type: 'person',
        });
        store.capture({
            content: 'Jordan prefers detailed end-of-day summaries.',
            source: {
                actorId: 'discord:workspace:user-b',
                actorKind: 'user',
                participantId: 'participant-b',
            },
            tags: ['person'],
            title: 'Jordan Preference B',
            type: 'person',
        });

        const result = await store.recall({
            limit: 10,
            query: 'Jordan summaries',
            scope: { participantId: 'participant-a' },
        });

        expect(result.hits.map((hit) => hit.page.slug)).toEqual(['jordan-preference-a']);
        expect(result.hits[0]?.evidence[0]?.locator).toBe('discord:workspace:user-a');
    });

    test('shared recall includes unscoped memory but excludes unrelated scoped memory', async () => {
        const store = createCortexHarness();

        store.capture({
            content: 'Tavern prefers source-linked durable memory.',
            source: {
                actorId: 'system',
                actorKind: 'system',
            },
            tags: ['memory'],
            title: 'Shared Memory Rule',
            type: 'fact',
        });
        store.capture({
            content: 'A private participant detail about durable memory.',
            source: {
                actorId: 'participant-b-source',
                actorKind: 'user',
                participantId: 'participant-b',
            },
            tags: ['person'],
            title: 'Private Participant Memory',
            type: 'person',
        });

        const result = await store.recall({
            limit: 10,
            query: 'durable memory',
            scope: { participantId: 'participant-a' },
        });

        expect(result.hits.map((hit) => hit.page.slug)).toEqual(['shared-memory-rule']);
    });

    test('recall applies limit while preserving source evidence', async () => {
        const store = createCortexHarness();

        for (let index = 1; index <= 3; index += 1) {
            store.capture({
                content: `Bounded prompt memory fact ${index}.`,
                source: {
                    actorId: `user-${index}`,
                    actorKind: 'user',
                    messageId: `msg-${index}`,
                },
                tags: ['memory'],
                title: `Bounded Memory ${index}`,
                type: 'fact',
            });
        }

        const result = await store.recall({ limit: 2, query: 'bounded prompt memory' });

        expect(result.hits).toHaveLength(2);
        expect(result.hits.every((hit) => hit.evidence.length > 0)).toBe(true);
        expect(result.hits.map((hit) => hit.evidence[0]?.locator).sort()).toEqual([
            'msg-1',
            'msg-2',
        ]);
    });

    test('recall excludes archived and deleted pages but keeps stale pages lexically searchable', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const active = store.capture({
            content: 'Recall quality active record.',
            source: {
                actorId: 'user-active',
                actorKind: 'user',
            },
            tags: [],
            title: 'Recall Active',
            type: 'fact',
        });
        const stale = store.capture({
            content: 'Recall quality stale lexical record.',
            source: {
                actorId: 'user-stale',
                actorKind: 'user',
            },
            tags: [],
            title: 'Recall Stale',
            type: 'fact',
        });
        const archived = store.capture({
            content: 'Recall quality archived record.',
            source: {
                actorId: 'user-archived',
                actorKind: 'user',
            },
            tags: [],
            title: 'Recall Archived',
            type: 'fact',
        });
        const deleted = store.capture({
            content: 'Recall quality deleted record.',
            source: {
                actorId: 'user-deleted',
                actorKind: 'user',
            },
            tags: [],
            title: 'Recall Deleted',
            type: 'fact',
        });

        db.prepare("UPDATE cortex_pages SET status = 'stale' WHERE id = ?").run(stale.page.id);
        db.prepare("UPDATE cortex_pages SET status = 'archived' WHERE id = ?").run(
            archived.page.id
        );
        db.prepare(
            "UPDATE cortex_pages SET status = 'deleted', deleted_at = updated_at WHERE id = ?"
        ).run(deleted.page.id);

        const result = await store.recall({ limit: 10, query: 'recall quality record' });

        expect(result.hits.map((hit) => hit.page.id).sort()).toEqual(
            [active.page.id, stale.page.id].sort()
        );
    });

    test('edits Cortex pages through canonical markdown and audit', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const result = store.edit({
            action: 'upsert',
            body: 'Launch page uses [[shopify]].',
            compiledTruth: 'Launch page uses Shopify.',
            links: [{ linkKind: 'uses', targetSlug: 'shopify' }],
            source: { actorId: 'user-1', actorKind: 'user' },
            tags: ['pod'],
            timelineEntries: ['User defined the launch page stack.'],
            title: 'Launch Page',
            type: 'project',
        });

        expect(result.auditId).toMatch(/^ctxa_/u);
        expect(store.getPage('launch-page')).toMatchObject({
            body: 'Launch page uses [[shopify]].',
            compiledTruth: 'Launch page uses Shopify.',
        });
        expect(store.listBacklinks('shopify').links).toEqual(
            expect.arrayContaining([expect.objectContaining({ linkKind: 'uses' })])
        );
        expect(
            store.getPage('launch-page')?.links.filter((link) => link.linkKind === 'uses')
        ).toHaveLength(1);
        await expect(Bun.file(path.join(wikiPath, 'launch-page.md')).text()).resolves.toContain(
            'User defined the launch page stack.'
        );
        expect(readLatestAudit(db, 'page.upsert')).toMatchObject({ status: 'success' });
    });

    test('archives merges and splits Cortex pages with preserved evidence', async () => {
        const store = createCortexHarness();
        const source = { actorId: 'user-1', actorKind: 'user' as const };
        store.edit({
            action: 'upsert',
            body: 'Original page detail.',
            compiledTruth: 'Original page detail.',
            source,
            timelineEntries: ['Original evidence.'],
            title: 'Original Page',
            type: 'note',
        });
        store.edit({
            action: 'upsert',
            body: 'Target page detail.',
            compiledTruth: 'Target page detail.',
            source,
            title: 'Target Page',
            type: 'note',
        });

        store.edit({
            action: 'merge',
            source,
            sourceSlugOrId: 'original-page',
            targetSlugOrId: 'target-page',
        });
        store.edit({
            action: 'split',
            pages: [
                {
                    body: 'Split detail.',
                    compiledTruth: 'Split detail.',
                    title: 'Split Page',
                    type: 'note',
                },
            ],
            source,
            sourceSlugOrId: 'target-page',
        });
        store.edit({ action: 'archive', slugOrId: 'split-page', source });

        expect(store.getPage('original-page')?.status).toBe('archived');
        expect(store.getPage('target-page')?.timeline.map((entry) => entry.body)).toEqual(
            expect.arrayContaining(['Original evidence.', 'Split into 1 Cortex page(s).'])
        );
        expect(store.getPage('split-page')?.status).toBe('archived');
        await store.runJob('maintenance');
        expect(store.getPage('original-page')?.links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    linkKind: 'same_as',
                    targetSlug: 'target-page',
                }),
            ])
        );
        await expect(Bun.file(path.join(wikiPath, 'original-page.md')).text()).resolves.toContain(
            'same_as: ["target-page"]'
        );
    });

    test('new contradictory claims supersede older active claims', () => {
        const store = createCortexHarness();
        const source = { actorId: 'user-1', actorKind: 'user' as const };
        store.edit({
            action: 'upsert',
            claims: [
                {
                    predicate: 'prefers',
                    status: 'active',
                    subject: 'User',
                    value: 'Short reports.',
                },
            ],
            compiledTruth: 'User prefers short reports.',
            source,
            title: 'Report Preference',
            type: 'note',
        });
        store.edit({
            action: 'upsert',
            claims: [
                {
                    predicate: 'prefers',
                    status: 'active',
                    subject: 'User',
                    value: 'Detailed weekly reports.',
                },
            ],
            compiledTruth: 'User prefers detailed weekly reports.',
            links: [{ linkKind: 'contradicts', targetSlug: 'report-preference' }],
            source,
            title: 'Report Preference',
            type: 'note',
        });

        const page = store.getPage('report-preference');
        expect(page?.claims).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ status: 'superseded', value: 'Short reports.' }),
                expect.objectContaining({
                    status: 'active',
                    supersedesClaimId: expect.any(String),
                    value: 'Detailed weekly reports.',
                }),
            ])
        );
        expect(page?.links).toEqual(
            expect.arrayContaining([expect.objectContaining({ linkKind: 'contradicts' })])
        );
    });

    test('missing embeddings do not block lexical recall', async () => {
        const store = createCortexHarness();

        store.capture({
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

    test('generate-embeddings refreshes derived page state before embedding', async () => {
        const store = createCortexHarness();
        store.capture({
            content: 'This page points at [[first-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Link Test',
            type: 'note',
        });

        const run = await store.runJob('generate-embeddings');

        expect(run.status).toBe('success');
        expect(run.summary).toContain('Generated embeddings for 0 Cortex chunk(s)');
        expect(store.listBacklinks('first-target').links).toHaveLength(1);
        expect((await store.status()).vectorIndex).toMatchObject({
            backend: 'memory',
            degradedReason: 'OpenAI API key is not configured.',
            indexedCount: 0,
        });
    });

    test('generate-embeddings embeds chunks when an OpenAI API key is configured', async () => {
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

        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Semantic embedding fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Semantic Embedding',
            type: 'fact',
        });
        expect(store.getPage('semantic-embedding')?.indexing).toMatchObject({
            chunkCount: 2,
            currentEmbeddingCount: 0,
            missingEmbeddingCount: 2,
            staleEmbeddingCount: 0,
            status: 'needs-indexing',
        });

        const run = await store.runJob('generate-embeddings');

        expect(run.summary).toContain('Generated embeddings for 2 Cortex chunk(s)');
        expect(store.getPage('semantic-embedding')?.indexing).toMatchObject({
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
            backend: 'memory',
            degradedReason: null,
            indexedCount: 2,
        });
        expect(fetchSpy).toHaveBeenCalled();

        const secondRun = await store.runJob('generate-embeddings');

        expect(secondRun.summary).toContain('Generated embeddings for 0 Cortex chunk(s)');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    test('embedding model changes preserve the saved OpenAI key', async () => {
        const store = createCortexHarness();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        data: [{ embedding: Array.from({ length: 3072 }, () => 0.1) }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );

        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.saveSettings({
            embedding: {
                model: 'text-embedding-3-large',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Large embedding model fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Large Embedding',
            type: 'fact',
        });

        await store.runJob('generate-embeddings');

        const firstCall = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
        expect(JSON.parse(String(firstCall?.body))).toMatchObject({
            model: 'text-embedding-3-large',
        });
        expect((await store.status()).encoding).toMatchObject({
            currentCount: 2,
            dimensions: 3072,
            model: 'text-embedding-3-large',
            provider: 'openai',
            totalCount: 2,
        });
    });

    test('maintenance jobs report lint and maintenance work', async () => {
        const store = createCortexHarness();
        store.capture({
            content: 'This page points at [[missing-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Maintenance Test',
            type: 'note',
        });

        expect((await store.runJob('lint')).summary).toContain('1 unresolved link(s)');
        expect((await store.runJob('maintenance')).summary).toContain(
            'Repaired derived Cortex links and chunks for 1 page(s)'
        );
        expect((await store.status()).lastMaintenanceAt).toEqual(expect.any(String));
    });

    test('manual Cortex jobs appear in Runtime job status history', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'Manual lint should show up in status.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Manual Job Status',
            type: 'note',
        });

        const run = await store.runManualJob('lint');
        const status = await store.status();

        expect(status.jobRuns[0]).toMatchObject({
            job: 'lint',
            status: 'success',
            summary: run.summary,
        });
        const row = db
            .prepare(
                `SELECT job_slug, trigger, state, logs_json, metadata_json
                 FROM runtime_job_runs
                 WHERE job_slug = 'cortex-lint'
                 LIMIT 1`
            )
            .get() as {
            job_slug: string;
            logs_json: string;
            metadata_json: string;
            state: string;
            trigger: string;
        };
        expect(row).toMatchObject({
            job_slug: 'cortex-lint',
            state: 'completed',
            trigger: 'manual',
        });
        expect(JSON.parse(row.logs_json)).toEqual([run.summary]);
        expect(JSON.parse(row.metadata_json)).toEqual({ auditId: run.auditId });
    });

    test('status recommends actions from Cortex lint findings', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'Health check links to [[missing-health-target]].',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Health Recommendation',
            type: 'note',
        });
        db.prepare('DELETE FROM cortex_chunks').run();

        const status = await store.status();

        expect(status.recommendations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'run-cortex-maintenance',
                    count: 1,
                    kind: 'unresolved-link',
                    severity: 'warning',
                }),
                expect.objectContaining({
                    action: 'run-cortex-maintenance',
                    count: 1,
                    kind: 'missing-chunks',
                    severity: 'warning',
                }),
                expect.objectContaining({
                    action: 'configure-embeddings',
                    kind: 'embedding-not-configured',
                    severity: 'info',
                }),
            ])
        );
    });

    test('status routes missing embedding recommendations to the embedding job', async () => {
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Missing embedding recommendation content.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Missing Embedding Recommendation',
            type: 'note',
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

    test('status routes stale embedding recommendations to the embedding job', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Stale embedding recommendation content.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Stale Embedding Recommendation',
            type: 'note',
        });
        const chunk = db.prepare('SELECT id FROM cortex_chunks LIMIT 1').get() as { id: string };
        db.prepare(
            `INSERT INTO cortex_encodings
             (id, chunk_id, provider, model, dimensions, vector_json, input_text_hash, embedded_at)
             VALUES ('ctxe_stale_recommendation', ?, 'openai', 'text-embedding-3-small', 1536, '[]', 'old-hash', ?)`
        ).run(chunk.id, new Date().toISOString());

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

    test('sync projects markdown pages and schema-derived frontmatter links', async () => {
        const store = createCortexHarness();
        await mkdir(path.join(wikiPath, 'products'), { recursive: true });
        await writeFile(
            path.join(wikiPath, 'products/launch-shirt.md'),
            [
                '---',
                'type: product',
                'platforms: ["platforms/shopify"]',
                'metrics: ["metrics/conversion-rate"]',
                '---',
                '',
                '# Launch Shirt',
                '',
                '## Compiled Truth',
                '',
                'Launch Shirt uses [[platforms/shopify]].',
                '',
                '## Body',
                '',
                'Track metrics/conversion-rate for launch quality.',
            ].join('\n')
        );

        expect((await store.runJob('sync')).summary).toContain('Synced 1 Cortex markdown page(s).');
        const page = store.getPage('products/launch-shirt');

        expect(page).toMatchObject({
            slug: 'products/launch-shirt',
            title: 'Launch Shirt',
            type: 'product',
        });
        expect(page?.links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ linkKind: 'uses', targetSlug: 'platforms/shopify' }),
                expect.objectContaining({
                    linkKind: 'tracks',
                    targetSlug: 'metrics/conversion-rate',
                }),
            ])
        );
    });

    test('sync updates corrected markdown content and recall returns the latest text', async () => {
        const store = createCortexHarness();
        const pagePath = path.join(wikiPath, 'launch-channel.md');
        await writeFile(
            pagePath,
            [
                '---',
                'type: decision',
                '---',
                '',
                '# Launch Channel',
                '',
                '## Compiled Truth',
                '',
                'Launch shirts use Shopify checkout.',
                '',
                '## Body',
                '',
                'The original launch channel was Shopify.',
            ].join('\n')
        );
        await store.runJob('sync');

        await writeFile(
            pagePath,
            [
                '---',
                'type: decision',
                '---',
                '',
                '# Launch Channel',
                '',
                '## Compiled Truth',
                '',
                'Launch shirts use Fourthwall checkout.',
                '',
                '## Body',
                '',
                'The corrected launch channel is Fourthwall.',
            ].join('\n')
        );

        await store.runJob('sync');
        const result = await store.recall({ limit: 5, query: 'Fourthwall checkout' });

        expect(store.getPage('launch-channel')).toMatchObject({
            compiledTruth: 'Launch shirts use Fourthwall checkout.',
        });
        expect(result.hits[0]?.page.slug).toBe('launch-channel');
        expect(result.hits[0]?.snippet).toContain('Fourthwall');
    });

    test('sync handles markdown renames that preserve the Cortex page id', async () => {
        const store = createCortexHarness();
        const firstPath = path.join(wikiPath, 'old-name.md');
        const secondPath = path.join(wikiPath, 'new-name.md');
        await writeFile(
            firstPath,
            [
                '---',
                'type: note',
                '---',
                '',
                '# Old Name',
                '',
                '## Compiled Truth',
                '',
                'The first file name is old.',
            ].join('\n')
        );
        await store.runJob('sync');
        const original = store.getPage('old-name');

        await rm(firstPath);
        await writeFile(
            secondPath,
            [
                '---',
                `id: ${original?.id}`,
                'type: note',
                '---',
                '',
                '# New Name',
                '',
                '## Compiled Truth',
                '',
                'The file name changed.',
            ].join('\n')
        );

        await store.runJob('sync');

        expect(store.getPage('new-name')).toMatchObject({
            compiledTruth: 'The file name changed.',
            id: original?.id,
        });
    });

    test('sync refreshes alias lookup rows from markdown frontmatter', async () => {
        const store = createCortexHarness();
        const filePath = path.join(wikiPath, 'alias-page.md');
        await writeFile(
            filePath,
            [
                '---',
                'aliases: ["Alias Page Legacy", "alias-page-old"]',
                'type: note',
                '---',
                '',
                '# Alias Page',
                '',
                '## Compiled Truth',
                '',
                'The alias lookup should resolve to this page.',
            ].join('\n')
        );

        await store.runJob('sync');

        expect(store.getPage('alias-page-legacy')).toMatchObject({
            slug: 'alias-page',
        });
        expect(store.getPage('Alias Page Legacy')).toMatchObject({
            slug: 'alias-page',
        });

        await writeFile(
            filePath,
            [
                '---',
                'aliases: ["Alias Page Current"]',
                'type: note',
                '---',
                '',
                '# Alias Page',
                '',
                '## Compiled Truth',
                '',
                'The alias lookup should refresh stale aliases.',
            ].join('\n')
        );

        await store.runJob('sync');

        expect(store.getPage('alias-page-legacy')).toBeNull();
        expect(store.getPage('alias-page-current')).toMatchObject({
            compiledTruth: 'The alias lookup should refresh stale aliases.',
            slug: 'alias-page',
        });
    });

    test('sync extracts markdown graph links and timeline evidence', async () => {
        const store = createCortexHarness();
        await writeFile(
            path.join(wikiPath, 'campaign-brief.md'),
            [
                '---',
                'type: campaign',
                'platforms: ["shopify"]',
                '---',
                '',
                '# Campaign Brief',
                '',
                '## Compiled Truth',
                '',
                'Campaign Brief uses [[shopify]] and tracks [conversion](conversion-rate).',
                '',
                '## Body',
                '',
                'The brief links storefront work to conversion-rate monitoring.',
                '',
                '---',
                '',
                '## Timeline',
                '',
                '### 2026-05-28T12:00:00.000Z',
                '',
                'User chose the launch platform and metric.',
            ].join('\n')
        );

        await store.runJob('sync');
        const page = store.getPage('campaign-brief');

        expect(page?.links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ linkKind: 'uses', targetSlug: 'shopify' }),
                expect.objectContaining({
                    linkKind: 'mentions',
                    targetSlug: 'conversion-rate',
                }),
            ])
        );
        expect(page?.timeline).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    body: 'User chose the launch platform and metric.',
                }),
            ])
        );
        expect(store.listBacklinks('shopify').links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fromPageId: page?.id,
                    linkKind: 'uses',
                }),
            ])
        );
    });

    test('maintenance backfills derived links and chunks from projected Cortex pages', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.capture({
            content: 'Derived state page uses [[shopify]] for launch checkout.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                messageId: 'msg-derived-state',
            },
            tags: [],
            title: 'Derived State Page',
            type: 'note',
        });
        db.prepare('DELETE FROM cortex_links').run();
        db.prepare('DELETE FROM cortex_chunks').run();

        expect(countRows(db, 'cortex_links')).toBe(0);
        expect(countRows(db, 'cortex_chunks')).toBe(0);

        await store.runJob('maintenance');

        expect(store.listBacklinks('shopify').links).toHaveLength(1);
        expect(store.getPage('derived-state-page')?.timeline).toHaveLength(1);
        expect(countRows(db, 'cortex_chunks')).toBeGreaterThan(0);
    });

    test('saves editable Cortex schema versions with audit', () => {
        const db = getDb();
        const active = getActiveCortexSchemaRecord(db);
        const saved = saveActiveCortexSchema(db, {
            ...active.schema,
            linkTypes: [...active.schema.linkTypes, { name: 'replaces' }],
            name: 'solopreneur-schema',
        });

        expect(saved.schema).toMatchObject({
            name: 'solopreneur-schema',
            version: active.schema.version + 1,
        });
        expect(saved.schema.linkTypes).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'replaces' })])
        );
        expect(countRows(db, 'cortex_audit_events')).toBeGreaterThan(0);
    });

    test('saves editable Cortex schema versions without requiring a schema rename', () => {
        const db = getDb();
        const active = getActiveCortexSchemaRecord(db);
        const saved = saveActiveCortexSchema(db, {
            ...active.schema,
            linkTypes: [...active.schema.linkTypes, { name: 'replaces' }],
        });

        expect(saved.schema).toMatchObject({
            name: active.schema.name,
            version: active.schema.version + 1,
        });
    });

    test('schema save reports active link kind validation warnings', () => {
        const store = createCortexHarness();
        const db = getDb();
        store.edit({
            action: 'upsert',
            compiledTruth: 'Schema warning page uses Shopify.',
            links: [{ linkKind: 'uses', targetSlug: 'shopify' }],
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Schema Warning Page',
            type: 'note',
        });
        const active = getActiveCortexSchemaRecord(db);
        const saved = saveActiveCortexSchema(db, {
            ...active.schema,
            frontmatterMappings: active.schema.frontmatterMappings.filter(
                (mapping) => mapping.linkType !== 'uses'
            ),
            linkTypes: active.schema.linkTypes.filter((type) => type.name !== 'uses'),
            name: 'warning-schema',
        });

        expect(saved.validation).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    affectedCount: expect.any(Number),
                    kind: 'removed-active-link-type',
                    value: 'uses',
                }),
            ])
        );
    });

    test('dream requires Codex OAuth credentials', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = '2026-05-28T12:00:00.000Z';
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-dream', 'Dream source', ?, ?, 1)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-dream', 'chat-dream', 1, 'user-1', 'user',
              'remember: Shopify launch shirts need conversion-rate tracking.', ?, '{}')`
        ).run(now);

        await expect(store.runJob('dream')).rejects.toThrow(
            'Codex OAuth credentials are required for Cortex Dream.'
        );
        expect(readLatestAudit(db, 'dream.review')).toMatchObject({
            metadata: expect.objectContaining({
                messageIds: ['msg-dream'],
                route: 'https://chatgpt.com/backend-api/codex/responses',
            }),
            status: 'error',
            summary: 'Codex OAuth credentials are required for Cortex Dream.',
        });
    });

    test('signal requires Codex OAuth credentials and keeps the chat cursor unchanged', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = '2026-05-28T12:00:00.000Z';
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-signal', 'Signal source', ?, ?, 1)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-signal', 'chat-signal', 1, 'user-1', 'user',
              'Remember that POD ad tests should track thumb-stop rate.', ?, '{}')`
        ).run(now);

        await expect(store.runJob('signal')).rejects.toThrow(
            'Codex OAuth credentials are required for Cortex Signal.'
        );

        expect(readLatestAudit(db, 'signal.review')).toMatchObject({
            metadata: expect.objectContaining({
                chatId: 'chat-signal',
                messageIds: ['msg-signal'],
                route: 'https://chatgpt.com/backend-api/codex/responses',
            }),
            status: 'error',
            summary: 'Codex OAuth credentials are required for Cortex Signal.',
        });
        expect(readSignalCursor(db, 'chat-signal')).toBeNull();
    });

    test('signal reviews per-chat backlog and advances the cursor after successful apply', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = '2026-05-28T12:00:00.000Z';
        const codexHome = path.join(wikiPath, 'codex-home-signal');
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
        process.env.TAVERN_CORTEX_SIGNAL_MODEL = 'gpt-signal-test';
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [
                                {
                                    locator: 'msg-signal-model',
                                    pageSlug: 'pod-ad-metrics',
                                    quote: 'Thumb-stop rate is the first POD ad metric.',
                                },
                            ],
                            noops: [],
                            observations: [
                                {
                                    confidence: 0.8,
                                    pageSlug: 'pod-ad-metrics',
                                    predicate: 'tracks',
                                    subject: 'POD ad tests',
                                    value: 'Thumb-stop rate is the first metric to track.',
                                },
                            ],
                            pageWrites: [
                                {
                                    body: 'Thumb-stop rate is the first metric to track for POD ad tests.',
                                    compiledTruth:
                                        'Thumb-stop rate is the first metric to track for POD ad tests.',
                                    slug: 'pod-ad-metrics',
                                    tags: ['pod'],
                                    title: 'POD Ad Metrics',
                                    type: 'metric',
                                },
                            ],
                            relationships: [
                                {
                                    fromSlug: 'pod-ad-metrics',
                                    linkKind: 'tracks',
                                    targetSlug: 'pod-ad-tests',
                                },
                            ],
                            timelineEntries: [
                                {
                                    body: 'Chat source recorded the thumb-stop rate metric.',
                                    pageSlug: 'pod-ad-metrics',
                                },
                            ],
                            warnings: [],
                        }),
                        usage: { input_tokens: 120, output_tokens: 40 },
                    }),
                    {
                        headers: {
                            'content-type': 'application/json',
                            'x-request-id': 'signal-request-1',
                        },
                        status: 200,
                    }
                )
        );
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-signal-model', 'Signal model source', ?, ?, 2)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-signal-ack', 'chat-signal-model', 1, 'user-1', 'user',
              'ok', ?, '{}')`
        ).run(now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-signal-model', 'chat-signal-model', 2, 'user-1', 'user',
              'Thumb-stop rate is the first POD ad metric.', ?, '{}')`
        ).run(now);

        const run = await store.runJob('signal');
        const page = store.getPage('pod-ad-metrics');
        const request = fetchSpy.mock.calls[0];
        const headers = new Headers((request?.[1] as RequestInit | undefined)?.headers);

        expect(run.summary).toContain('Signal reviewed 1 chat message(s)');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(headers.get('authorization')).toBe('Bearer codex-access-token');
        expect(headers.get('chatgpt-account-id')).toBe('account-1');
        expect(JSON.parse(String((request?.[1] as RequestInit | undefined)?.body))).toMatchObject({
            model: 'gpt-signal-test',
        });
        expect(page).toMatchObject({
            compiledTruth: 'Thumb-stop rate is the first metric to track for POD ad tests.',
            type: 'metric',
        });
        expect(page?.tags).toEqual(expect.arrayContaining(['signal', 'pod']));
        expect(page?.tags).not.toContain('dream');
        expect(page?.links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    linkKind: 'tracks',
                    targetSlug: 'pod-ad-tests',
                }),
            ])
        );
        expect(page?.links.filter((link) => link.linkKind === 'tracks')).toHaveLength(1);
        expect(readSignalCursor(db, 'chat-signal-model')).toMatchObject({
            last_processed_message_id: 'msg-signal-model',
            last_processed_sequence: 2,
        });
        expect(readLatestAudit(db, 'signal.review')).toMatchObject({
            metadata: expect.objectContaining({
                chatId: 'chat-signal-model',
                messageIds: ['msg-signal-model'],
                model: 'gpt-signal-test',
                requestId: 'signal-request-1',
                tokenCounts: { input_tokens: 120, output_tokens: 40 },
            }),
            status: 'success',
        });
    });

    test('dream uses Codex OAuth model review when Codex auth is available', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = '2026-05-28T12:00:00.000Z';
        const codexHome = path.join(wikiPath, 'codex-home');
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
        process.env.TAVERN_CORTEX_DREAM_MODEL = 'gpt-test';
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [
                                {
                                    locator: 'msg-dream-model',
                                    pageSlug: 'launch-ad-mockups',
                                    quote: 'We should use DTG mockups in launch ads.',
                                },
                            ],
                            noops: [],
                            observations: [
                                {
                                    confidence: 0.8,
                                    pageSlug: 'launch-ad-mockups',
                                    predicate: 'uses',
                                    subject: 'Launch ads',
                                    value: 'Use direct-to-garment mockups for launch ads.',
                                },
                            ],
                            pageWrites: [
                                {
                                    body: 'Use direct-to-garment mockups for launch ads.',
                                    compiledTruth: 'Use direct-to-garment mockups for launch ads.',
                                    slug: 'launch-ad-mockups',
                                    tags: ['pod'],
                                    title: 'Launch Ad Mockups',
                                    type: 'decision',
                                },
                            ],
                            relationships: [
                                {
                                    fromSlug: 'launch-ad-mockups',
                                    linkKind: 'uses',
                                    targetSlug: 'direct-to-garment',
                                },
                            ],
                            timelineEntries: [
                                {
                                    body: 'Chat source recorded the launch ad mockup decision.',
                                    pageSlug: 'launch-ad-mockups',
                                },
                            ],
                            warnings: [],
                        }),
                    }),
                    {
                        headers: {
                            'content-type': 'application/json',
                            'x-request-id': 'dream-request-1',
                        },
                        status: 200,
                    }
                )
        );
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-dream-model', 'Dream model source', ?, ?, 1)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-dream-model', 'chat-dream-model', 1, 'user-1', 'user',
              'We should use DTG mockups in launch ads.', ?, '{}')`
        ).run(now);

        const run = await store.runJob('dream');
        const page = store.getPage('launch-ad-mockups');
        const request = fetchSpy.mock.calls[0];
        const headers = new Headers((request?.[1] as RequestInit | undefined)?.headers);

        expect(run.summary).toContain('with model review');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(String(request?.[0])).toBe('https://chatgpt.com/backend-api/codex/responses');
        expect(headers.get('authorization')).toBe('Bearer codex-access-token');
        expect(headers.get('chatgpt-account-id')).toBe('account-1');
        expect(JSON.parse(String((request?.[1] as RequestInit | undefined)?.body))).toMatchObject({
            model: 'gpt-test',
        });
        expect(page).toMatchObject({
            compiledTruth: 'Use direct-to-garment mockups for launch ads.',
            type: 'decision',
        });
        expect(page?.tags).toEqual(expect.arrayContaining(['dream', 'pod']));
        expect(page?.claims).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    predicate: 'uses',
                    subject: 'Launch ads',
                    value: 'Use direct-to-garment mockups for launch ads.',
                }),
            ])
        );
        expect(page?.links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    linkKind: 'uses',
                    targetSlug: 'direct-to-garment',
                }),
            ])
        );
        expect(page?.timeline.at(-1)?.body).toBe(
            'Chat source recorded the launch ad mockup decision.'
        );
        await expect(
            Bun.file(path.join(wikiPath, 'launch-ad-mockups.md')).text()
        ).resolves.toContain('uses: ["direct-to-garment"]');
        expect(readDreamAuditMetadata(db)).toMatchObject({
            latencyMs: expect.any(Number),
            messageIds: ['msg-dream-model'],
            model: 'gpt-test',
            provider: 'codex',
            requestId: 'dream-request-1',
            route: 'https://chatgpt.com/backend-api/codex/responses',
            tokenCounts: null,
            warnings: [],
        });
    });

    test('dream records token counts and estimated cost when usage is returned', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = '2026-05-28T12:00:00.000Z';
        const codexHome = path.join(wikiPath, 'codex-home-usage');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: { access_token: 'codex-access-token', account_id: 'account-1' },
            })
        );
        process.env.CODEX_HOME = codexHome;
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [],
                            noops: [{ reason: 'No durable update.' }],
                            observations: [],
                            pageWrites: [],
                            relationships: [],
                            timelineEntries: [],
                            warnings: [],
                        }),
                        usage: { input_tokens: 100, output_tokens: 20 },
                    }),
                    { headers: { 'content-type': 'application/json' }, status: 200 }
                )
        );
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-dream-usage', 'Dream usage source', ?, ?, 1)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ('msg-dream-usage', 'chat-dream-usage', 1, 'user-1', 'user',
              'Temporary note with no durable update.', ?, '{}')`
        ).run(now);

        await store.runJob('dream');

        expect(readDreamAuditMetadata(db)).toMatchObject({
            estimatedCostUsd: expect.any(Number),
            tokenCounts: { input_tokens: 100, output_tokens: 20 },
        });
    });

    test('dream continues same-timestamp chat backlog with a stable id cursor', async () => {
        const store = createCortexHarness();
        const db = getDb();
        const now = Date.parse('2026-05-28T12:00:00.000Z');
        const codexHome = path.join(wikiPath, 'codex-home-backlog');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: { access_token: 'codex-access-token', account_id: 'account-1' },
            })
        );
        process.env.CODEX_HOME = codexHome;
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [],
                            noops: [{ reason: 'No durable update.' }],
                            observations: [],
                            pageWrites: [],
                            relationships: [],
                            timelineEntries: [],
                            warnings: [],
                        }),
                    }),
                    { headers: { 'content-type': 'application/json' }, status: 200 }
                )
        );
        db.prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ('chat-dream-backlog', 'Dream backlog source', ?, ?, 55)`
        ).run(new Date(now).toISOString(), new Date(now).toISOString());
        const insertMessage = db.prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ($id, 'chat-dream-backlog', $sequence, 'user-1', 'user',
              $content, $createdAt, '{}')`
        );
        for (let index = 1; index <= 55; index += 1) {
            const id = `msg-dream-${String(index).padStart(2, '0')}`;
            insertMessage.run({
                $content: `Backlog message ${index}.`,
                $createdAt: new Date(now).toISOString(),
                $id: id,
                $sequence: index,
            });
        }

        await store.runJob('dream');
        await store.runJob('dream');

        const firstPrompt = readCodexPrompt(fetchSpy, 0);
        const secondPrompt = readCodexPrompt(fetchSpy, 1);
        expect(firstPrompt).toContain('[user msg-dream-01]');
        expect(firstPrompt).toContain('[user msg-dream-50]');
        expect(firstPrompt).not.toContain('[user msg-dream-51]');
        expect(secondPrompt).toContain('[user msg-dream-51]');
        expect(secondPrompt).toContain('[user msg-dream-55]');
        expect(secondPrompt).not.toContain('[user msg-dream-50]');
    });

    test('dream archive proposals persist through markdown sync', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.edit({
            action: 'upsert',
            compiledTruth: 'Archive this retired offer.',
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Retired Offer',
            type: 'note',
        });

        applyDreamProposal(db, {
            model: 'gpt-test',
            outputHash: 'output-hash',
            promptHash: 'prompt-hash',
            proposal: {
                citations: [],
                noops: [],
                observations: [],
                pageWrites: [
                    {
                        action: 'archive',
                        compiledTruth: 'Retired.',
                        slug: 'retired-offer',
                        title: 'Retired Offer',
                        type: 'note',
                    },
                ],
                relationships: [],
                timelineEntries: [],
                warnings: [],
            },
            sourceRange: {
                captureKey: 'capture-key',
                messageIds: ['msg-archive'],
                sourceHash: 'source-hash',
                sourceRefs: [{ id: 'ctxs_archive', kind: 'user', locator: 'msg-archive' }],
                text: 'Archive the retired offer.',
            },
        });

        expect(store.getPage('retired-offer')?.status).toBe('archived');
        await expect(Bun.file(path.join(wikiPath, 'retired-offer.md')).text()).resolves.toContain(
            'status: archived'
        );
    });

    test('dream standalone relationships persist through markdown sync', async () => {
        const store = createCortexHarness();
        const db = getDb();
        store.edit({
            action: 'upsert',
            compiledTruth: 'Launch ads use a reusable mockup workflow.',
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Launch Ads',
            type: 'decision',
        });
        store.edit({
            action: 'upsert',
            compiledTruth: 'Direct-to-garment mockups are a POD asset type.',
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Direct To Garment',
            type: 'tool',
        });

        applyDreamProposal(db, {
            model: 'gpt-test',
            outputHash: 'output-hash',
            promptHash: 'prompt-hash',
            proposal: {
                citations: [],
                noops: [],
                observations: [],
                pageWrites: [],
                relationships: [
                    {
                        fromSlug: 'launch-ads',
                        linkKind: 'uses',
                        targetSlug: 'direct-to-garment',
                    },
                ],
                timelineEntries: [],
                warnings: [],
            },
            sourceRange: {
                captureKey: 'capture-key',
                messageIds: ['msg-relationship'],
                sourceHash: 'source-hash',
                sourceRefs: [
                    { id: 'ctxs_relationship', kind: 'user', locator: 'msg-relationship' },
                ],
                text: 'Launch ads use direct-to-garment mockups.',
            },
        });
        applyDreamProposal(db, {
            model: 'gpt-test',
            outputHash: 'output-hash-2',
            promptHash: 'prompt-hash-2',
            proposal: {
                citations: [],
                noops: [],
                observations: [],
                pageWrites: [],
                relationships: [
                    {
                        fromSlug: 'launch-ads',
                        label: 'mockup workflow',
                        linkKind: 'uses',
                        targetSlug: 'direct-to-garment',
                    },
                ],
                timelineEntries: [],
                warnings: [],
            },
            sourceRange: {
                captureKey: 'capture-key-2',
                messageIds: ['msg-relationship-2'],
                sourceHash: 'source-hash-2',
                sourceRefs: [
                    { id: 'ctxs_relationship_2', kind: 'user', locator: 'msg-relationship-2' },
                ],
                text: 'Launch ads still use direct-to-garment mockups.',
            },
        });
        expect(
            db
                .prepare(
                    `SELECT link_kind AS linkKind, source_location AS sourceLocation, target_slug AS targetSlug
                     FROM cortex_links
                     WHERE from_page_id = (SELECT id FROM cortex_pages WHERE slug = 'launch-ads')
                       AND target_slug = 'direct-to-garment'`
                )
                .all()
        ).toEqual([
            {
                linkKind: 'uses',
                sourceLocation: 'frontmatter:uses:0',
                targetSlug: 'direct-to-garment',
            },
        ]);
        await store.runJob('sync');

        expect(
            store
                .getPage('launch-ads')
                ?.links.filter(
                    (link) => link.linkKind === 'uses' && link.targetSlug === 'direct-to-garment'
                )
        ).toHaveLength(1);
        expect(store.listBacklinks('direct-to-garment').links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fromPageId: store.getPage('launch-ads')?.id,
                    linkKind: 'uses',
                }),
            ])
        );
        await expect(Bun.file(path.join(wikiPath, 'launch-ads.md')).text()).resolves.toContain(
            'uses: ["direct-to-garment"]'
        );
    });

    test('dream citation-only proposals upsert source refs before citations', () => {
        const store = createCortexHarness();
        const db = getDb();
        store.edit({
            action: 'upsert',
            compiledTruth: 'Launch ads use reusable mockups.',
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Launch Ads',
            type: 'decision',
        });

        expect(() =>
            applyDreamProposal(db, {
                model: 'gpt-test',
                outputHash: 'output-hash',
                promptHash: 'prompt-hash',
                proposal: {
                    citations: [
                        {
                            locator: 'msg-citation',
                            pageSlug: 'launch-ads',
                            quote: 'Launch ads use reusable mockups.',
                        },
                    ],
                    noops: [],
                    observations: [],
                    pageWrites: [],
                    relationships: [],
                    timelineEntries: [],
                    warnings: [],
                },
                sourceRange: {
                    captureKey: 'capture-key',
                    messageIds: ['msg-citation'],
                    sourceHash: 'source-hash',
                    sourceRefs: [{ id: 'ctxs_citation', kind: 'user', locator: 'msg-citation' }],
                    text: 'Launch ads use reusable mockups.',
                },
            })
        ).not.toThrow();
        expect(
            db
                .prepare('SELECT source_id FROM cortex_citations WHERE locator = ?')
                .get('msg-citation')
        ).toMatchObject({ source_id: 'ctxs_citation' });
    });

    test('signal and dream use stable chat message source ids for citations', () => {
        const store = createCortexHarness();
        const db = getDb();
        store.edit({
            action: 'upsert',
            compiledTruth: 'Launch ads use reusable mockups.',
            source: { actorId: 'user-1', actorKind: 'user' },
            title: 'Launch Ads',
            type: 'decision',
        });
        const signalSourceRef = sourceRefFromSignalMessage({
            author_id: 'user-1',
            chat_id: 'chat-1',
            content: 'Launch ads use reusable mockups.',
            created_at: new Date().toISOString(),
            id: 'msg-shared-source',
            role: 'user',
            sequence: 1,
        });

        db.prepare(
            `INSERT INTO cortex_sources
             (id, kind, locator, hash, metadata_json, created_at, updated_at)
             VALUES ($id, $kind, $locator, $hash, '{}', $createdAt, $updatedAt)`
        ).run({
            $createdAt: new Date().toISOString(),
            $hash: 'dream-source-hash',
            $id: signalSourceRef.id,
            $kind: signalSourceRef.kind,
            $locator: signalSourceRef.locator,
            $updatedAt: new Date().toISOString(),
        });

        expect(() =>
            applyDreamProposal(db, {
                model: 'gpt-test',
                outputHash: 'output-hash',
                promptHash: 'prompt-hash',
                proposal: {
                    citations: [
                        {
                            locator: 'msg-shared-source',
                            pageSlug: 'launch-ads',
                            quote: 'Launch ads use reusable mockups.',
                        },
                    ],
                    noops: [],
                    observations: [],
                    pageWrites: [],
                    relationships: [],
                    timelineEntries: [],
                    warnings: [],
                },
                sourceRange: {
                    captureKey: 'capture-key',
                    messageIds: ['msg-shared-source'],
                    sourceHash: 'source-hash',
                    sourceRefs: [signalSourceRef],
                    text: 'Launch ads use reusable mockups.',
                },
            })
        ).not.toThrow();
        expect(
            db
                .prepare('SELECT source_id FROM cortex_citations WHERE locator = ?')
                .get('msg-shared-source')
        ).toMatchObject({ source_id: signalSourceRef.id });
    });

    test('writes canonical markdown for slash-containing slugs', async () => {
        const store = createCortexHarness();
        const result = store.capture({
            content: 'Nested project fact.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Project/Foo',
            type: 'project',
        });

        expect(result.page.slug).toBe('project/foo');
        await expect(Bun.file(path.join(wikiPath, 'project/foo.md')).exists()).resolves.toBe(true);
        await expect(Bun.file(path.join(wikiPath, 'project/foo.md')).text()).resolves.toContain(
            'source_refs:'
        );
    });
});

function createCortexHarness() {
    const vectorDatabase = new MemoryVectorDatabase();
    return {
        capture: (input: Parameters<typeof captureCortex>[1]) => captureCortex(getDb(), input),
        edit: (input: Parameters<typeof editCortexPage>[1]) => editCortexPage(getDb(), input),
        getPage: (slugOrId: string) => getCortexPage(getDb(), slugOrId),
        listBacklinks: (target: string) => listCortexBacklinks(getDb(), target),
        listPages: () => listCortexPages(getDb()),
        recall: (input: Parameters<typeof recallCortex>[1]) =>
            recallCortex(getDb(), input, vectorDatabase),
        runJob: (job: Parameters<typeof runCortexJob>[1]) =>
            runCortexJob(getDb(), job, vectorDatabase),
        runManualJob: (job: Parameters<typeof runCortexJob>[1]) =>
            runCortexJob(getDb(), job, vectorDatabase, { recordRuntimeRun: true }),
        saveSettings: (input: Parameters<typeof saveCortexSettings>[1]) =>
            saveCortexSettings(getDb(), input),
        status: () => getCortexStatus(getDb(), vectorDatabase),
    };
}

function countRows(db: Database, table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function readFirstCaptureAttemptCount(db: Database): number {
    return (
        db
            .prepare('SELECT attempts FROM cortex_captures ORDER BY created_at ASC LIMIT 1')
            .get() as { attempts: number }
    ).attempts;
}

function readAuditMetadata(db: Database, auditId: string): Record<string, unknown> {
    const row = db
        .prepare('SELECT metadata_json FROM cortex_audit_events WHERE id = ?')
        .get(auditId) as { metadata_json: string };
    return JSON.parse(row.metadata_json) as Record<string, unknown>;
}

function readDreamAuditMetadata(db: Database): Record<string, unknown> {
    const row = db
        .prepare(
            `SELECT metadata_json
             FROM cortex_audit_events
             WHERE kind = 'dream.review'
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get() as { metadata_json: string };
    return JSON.parse(row.metadata_json) as Record<string, unknown>;
}

function readCodexPrompt(fetchSpy: { mock: { calls: Parameters<typeof fetch>[] } }, index: number) {
    const request = fetchSpy.mock.calls[index]?.[1];
    const body = JSON.parse(String(request?.body)) as {
        input: Array<{ content: string }>;
    };
    return body.input[0]?.content ?? '';
}

function readSignalCursor(
    db: Database,
    chatId: string
): {
    last_processed_message_id: string | null;
    last_processed_sequence: number;
} | null {
    return db
        .prepare(
            `SELECT last_processed_message_id, last_processed_sequence
             FROM cortex_signal_cursors
             WHERE chat_id = ?`
        )
        .get(chatId) as {
        last_processed_message_id: string | null;
        last_processed_sequence: number;
    } | null;
}

function readLatestAudit(
    db: Database,
    kind: string
): { metadata: Record<string, unknown>; status: string; summary: string } {
    const row = db
        .prepare(
            `SELECT metadata_json, status, summary
             FROM cortex_audit_events
             WHERE kind = ?
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(kind) as { metadata_json: string; status: string; summary: string };
    return {
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        status: row.status,
        summary: row.summary,
    };
}
