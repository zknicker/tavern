import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { getWikiPageHistory, getWikiPageRevision } from './page-history.ts';
import { createWikiPage, deleteWikiPage, getWikiPage, saveWikiPage } from './store.ts';

describe('Wiki page history', () => {
    let root: string;
    let previousWikiPath: string | undefined;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-history-'));
        previousWikiPath = process.env.TAVERN_WIKI_PATH;
        process.env.TAVERN_WIKI_PATH = root;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        if (previousWikiPath === undefined) {
            Reflect.deleteProperty(process.env, 'TAVERN_WIKI_PATH');
        } else {
            process.env.TAVERN_WIKI_PATH = previousWikiPath;
        }
        await fs.rm(root, { force: true, recursive: true });
    });

    test('lists the commits touching one page, newest first', async () => {
        await createWikiPage({ body: '# Notes\n\nfirst\n', path: 'Projects/Notes.md' });
        await saveCurrentPage('Projects/Notes.md', '# Notes\n\nsecond\n');
        await createWikiPage({ body: '# Other\n', path: 'Other.md' });

        const history = await getWikiPageHistory({ path: 'Projects/Notes.md' });
        expect(history.ready).toBe(true);
        expect(history.path).toBe('Projects/Notes.md');
        expect(history.commits).toHaveLength(2);
        expect(history.commits[0]?.subject).toBe('memory: save page');
        expect(history.commits[1]?.subject).toBe('memory: create page');
        expect(history.commits[0]?.hash).toMatch(/^[0-9a-f]{40}$/u);
        expect(history.commits[0]?.committedAt).toBeTruthy();
    });

    test('reads one commit as a before/after pair', async () => {
        await createWikiPage({ body: '# Notes\n\nfirst\n', path: 'Notes.md' });
        await saveCurrentPage('Notes.md', '# Notes\n\nsecond\n');

        const history = await getWikiPageHistory({ path: 'Notes.md' });
        const saveCommit = history.commits[0]?.hash ?? '';
        const createCommit = history.commits[1]?.hash ?? '';

        const saved = await getWikiPageRevision({ commit: saveCommit, path: 'Notes.md' });
        expect(saved.ready).toBe(true);
        expect(saved.commit?.hash).toBe(saveCommit);
        expect(saved.beforeText).toContain('first');
        expect(saved.afterText).toContain('second');

        const created = await getWikiPageRevision({ commit: createCommit, path: 'Notes.md' });
        expect(created.beforeText).toBeNull();
        expect(created.afterText).toContain('first');
    });

    test('deleted pages keep history and read as after-null revisions', async () => {
        await createWikiPage({ body: '# Gone\n', path: 'Gone.md' });
        await deleteWikiPage({ path: 'Gone.md' });

        const history = await getWikiPageHistory({ path: 'Gone.md' });
        expect(history.commits.length).toBeGreaterThanOrEqual(2);
        const deleteCommit = history.commits[0]?.hash ?? '';

        const revision = await getWikiPageRevision({ commit: deleteCommit, path: 'Gone.md' });
        expect(revision.beforeText).toContain('# Gone');
        expect(revision.afterText).toBeNull();
    });

    test('rejects revision reads with a non-hash commit', async () => {
        await createWikiPage({ body: '# Safe\n', path: 'Safe.md' });
        await expect(
            getWikiPageRevision({ commit: '--output=/tmp/pwn', path: 'Safe.md' })
        ).rejects.toThrow('commit hash');
    });
});

async function saveCurrentPage(pagePath: string, body: string) {
    const page = await getWikiPage({ path: pagePath });
    if (!page) {
        throw new Error(`Expected Wiki page ${pagePath}.`);
    }
    await saveWikiPage({ body, expectedHash: page.hash, path: pagePath });
}
