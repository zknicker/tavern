import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import type { Database } from '../db/sqlite';
import { ensureCortexSchema } from './schema';
import { CortexStore } from './store';

describe('CortexStore', () => {
    let wikiPath: string;

    beforeEach(async () => {
        wikiPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-wiki-'));
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureCortexSchema(db);
    });

    afterEach(async () => {
        closeDb();
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(wikiPath, { force: true, recursive: true });
    });

    test('captures a source-backed page with claims chunks encodings and audit', () => {
        const store = new CortexStore();
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
        expect(store.status()).toMatchObject({
            auditCount: 1,
            captureCount: 1,
            chunkCount: 2,
            claimCount: 2,
            encoding: {
                currentCount: 2,
                staleCount: 0,
                totalCount: 2,
            },
            linkCount: 1,
            pageCount: 1,
            sourceCount: 1,
        });
    });

    test('replayed capture returns existing output without duplicating timeline evidence', () => {
        const store = new CortexStore();
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

    test('same source boundary updates the page without creating a second capture record', () => {
        const store = new CortexStore();
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

    test('recall returns matching pages and writes audit', () => {
        const store = new CortexStore();
        store.capture({
            content: 'The OpenClaw prompt-time layer uses Lossless Claw.',
            source: {
                actorId: 'runtime',
                actorKind: 'runtime',
            },
            tags: ['openclaw'],
            title: 'OpenClaw Memory',
            type: 'fact',
        });

        const result = store.recall({ limit: 5, query: 'lossless claw memory' });

        expect(result.auditId).toMatch(/^ctxa_/u);
        expect(result.hits[0]?.page.slug).toBe('openclaw-memory');
        expect(result.hits[0]?.evidence[0]).toMatchObject({
            kind: 'runtime',
            locator: 'runtime',
        });
        expect(store.status().lastRecallAt).not.toBeNull();
    });

    test('participant-scoped recall does not merge same-name participants', () => {
        const store = new CortexStore();

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

        const result = store.recall({
            limit: 10,
            query: 'Jordan summaries',
            scope: { participantId: 'participant-a' },
        });

        expect(result.hits.map((hit) => hit.page.slug)).toEqual(['jordan-preference-a']);
        expect(result.hits[0]?.evidence[0]?.locator).toBe('discord:workspace:user-a');
    });

    test('shared recall includes unscoped memory but excludes unrelated scoped memory', () => {
        const store = new CortexStore();

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

        const result = store.recall({
            limit: 10,
            query: 'durable memory',
            scope: { participantId: 'participant-a' },
        });

        expect(result.hits.map((hit) => hit.page.slug)).toEqual(['shared-memory-rule']);
    });

    test('recall applies limit while preserving source evidence', () => {
        const store = new CortexStore();

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

        const result = store.recall({ limit: 2, query: 'bounded prompt memory' });

        expect(result.hits).toHaveLength(2);
        expect(result.hits.every((hit) => hit.evidence.length > 0)).toBe(true);
        expect(result.hits.map((hit) => hit.evidence[0]?.locator).sort()).toEqual([
            'msg-1',
            'msg-2',
        ]);
    });

    test('recall excludes archived and deleted pages but keeps stale pages lexically searchable', () => {
        const store = new CortexStore();
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

        const result = store.recall({ limit: 10, query: 'recall quality record' });

        expect(result.hits.map((hit) => hit.page.id).sort()).toEqual(
            [active.page.id, stale.page.id].sort()
        );
    });

    test('stale encodings do not block lexical recall or count as current vectors', () => {
        const store = new CortexStore();
        const db = getDb();

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
        db.prepare("UPDATE cortex_encodings SET input_text_hash = 'stale-hash'").run();

        const result = store.recall({ limit: 5, query: 'lexical fallback' });

        expect(result.hits[0]?.page.slug).toBe('stale-encoding');
        expect(store.status().encoding).toMatchObject({
            currentCount: 0,
            staleCount: 2,
            totalCount: 2,
        });
    });

    test('recall-index job rebuilds derived links after page edits', () => {
        const store = new CortexStore();
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

        const run = store.runJob('recall-index');

        expect(run.status).toBe('success');
        expect(store.listBacklinks('first-target').links).toHaveLength(1);
    });

    test('maintenance jobs report health lint and repair work', () => {
        const store = new CortexStore();
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

        expect(store.runJob('health').summary).toContain('1 unresolved link(s)');
        expect(store.runJob('lint').summary).toContain('1 unresolved link(s)');
        expect(store.runJob('repair').summary).toContain(
            'Repaired derived state and markdown mirrors for 1 page(s).'
        );
        expect(store.status().jobRuns[0]?.auditId).toMatch(/^ctxa_/u);
    });

    test('writes markdown mirrors for slash-containing slugs', async () => {
        const store = new CortexStore();
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
