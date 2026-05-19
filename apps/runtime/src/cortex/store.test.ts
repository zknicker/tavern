import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
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
    });

    test('same source and title updates the page when content changes', () => {
        const store = new CortexStore();
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
        expect(store.status().lastRecallAt).not.toBeNull();
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
