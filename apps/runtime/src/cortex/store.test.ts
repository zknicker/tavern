import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import type { Database } from '../db/sqlite';
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
import { MemoryVectorDatabase } from './vector-db/memory';
import { captureCortex } from './write';

describe('Cortex runtime storage', () => {
    let wikiPath: string;

    beforeEach(async () => {
        wikiPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-wiki-'));
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureCortexSchema(db);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        closeDb();
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
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
            sourceCount: 1,
        });
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
            requestedMode: null,
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
            'Repaired derived state, vector index, and markdown mirrors for 1 page(s).'
        );
        expect((await store.status()).jobRuns[0]?.auditId).toMatch(/^ctxa_/u);
    });

    test('writes markdown mirrors for slash-containing slugs', async () => {
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
    });
});

function createCortexHarness() {
    const vectorDatabase = new MemoryVectorDatabase();
    return {
        capture: (input: Parameters<typeof captureCortex>[1]) => captureCortex(getDb(), input),
        getPage: (slugOrId: string) => getCortexPage(getDb(), slugOrId),
        listBacklinks: (target: string) => listCortexBacklinks(getDb(), target),
        listPages: () => listCortexPages(getDb()),
        recall: (input: Parameters<typeof recallCortex>[1]) =>
            recallCortex(getDb(), input, vectorDatabase),
        runJob: (job: Parameters<typeof runCortexJob>[1]) =>
            runCortexJob(getDb(), job, vectorDatabase),
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
