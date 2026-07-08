import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeEvent } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events.ts';
import { commitWikiHistory, wasWikiPathDeletedRecently } from './history.ts';
import { closeWikiWatcher, getWikiWatcherFreshness, startWikiWatcher } from './watcher.ts';

type WikiChangedEvent = Extract<AgentRuntimeEvent, { type: 'wiki.changed' }>;

describe('Wiki watcher', () => {
    let root: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-watcher-'));
    });

    afterEach(async () => {
        await closeWikiWatcher();
        await fs.rm(root, { force: true, recursive: true });
    });

    test('publishes changed Markdown paths from the watched root', async () => {
        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await startTestWikiWatcher(root);

        const changed = waitForWikiChanged();

        await fs.writeFile(path.join(root, 'Projects', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(getWikiWatcherFreshness()).toMatchObject({
            live: true,
            state: 'watching',
        });
        expect(event).toMatchObject({
            paths: ['Projects/Alpha.md'],
            reason: 'watch',
            scope: 'content',
            type: 'wiki.changed',
        });
    });

    test('publishes changes when the Wiki root is inside a hidden parent', async () => {
        const hiddenRoot = path.join(root, '.owner', 'Wiki');
        await fs.mkdir(hiddenRoot, { recursive: true });
        await startTestWikiWatcher(hiddenRoot);

        const changed = waitForWikiChanged();

        await fs.writeFile(path.join(hiddenRoot, 'Notes.md'), '# Notes\n');

        const event = await changed;

        expect(event.paths).toEqual(['Notes.md']);
    });

    test('publishes changed Markdown paths inside dotted folder names', async () => {
        await fs.mkdir(path.join(root, 'Projects', '2026.06'), { recursive: true });
        await startTestWikiWatcher(root);

        const changed = waitForWikiChanged();

        await fs.writeFile(path.join(root, 'Projects', '2026.06', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Projects/2026.06/Alpha.md']);
    });

    test('publishes changed Markdown paths when the Wiki root is a symlink', async () => {
        const targetRoot = path.join(root, 'TargetWiki');
        const linkRoot = path.join(root, 'LinkedWiki');
        await fs.mkdir(targetRoot, { recursive: true });
        await fs.symlink(targetRoot, linkRoot, 'dir');
        await startTestWikiWatcher(linkRoot);

        const changed = waitForWikiChanged();

        await fs.writeFile(path.join(targetRoot, 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Alpha.md']);
    });

    test('publishes a coarse update for folder-only changes', async () => {
        await startTestWikiWatcher(root);

        const changed = waitForWikiChanged();

        await fs.mkdir(path.join(root, 'Projects'));

        const event = await changed;

        expect(event).toMatchObject({
            paths: [],
            reason: 'bulk',
            scope: 'content',
        });
    });

    test('records external deletes in local history before publishing changes', async () => {
        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await fs.writeFile(path.join(root, 'Projects', 'Alpha.md'), '# Alpha\n');
        await commitWikiHistory(root, { reason: 'baseline' });
        await startTestWikiWatcher(root);

        const changed = waitForWikiChanged();

        await fs.rm(path.join(root, 'Projects', 'Alpha.md'));

        const event = await changed;

        expect(event.paths).toEqual(['Projects/Alpha.md']);
        await expect(wasWikiPathDeletedRecently(root, 'Projects/Alpha.md')).resolves.toBe(true);
    });
});

async function startTestWikiWatcher(wikiPath: string) {
    await startWikiWatcher(() => ({ wikiPath }), {
        pollIntervalMs: 50,
        usePolling: true,
    });
}

function waitForWikiChanged() {
    let unsubscribe: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return new Promise<WikiChangedEvent>((resolve, reject) => {
        timeout = setTimeout(() => {
            unsubscribe?.();
            reject(new Error('Timed out waiting for Wiki watcher event.'));
        }, 5000);
        unsubscribe = subscribeToRuntimeEvents((candidate) => {
            if (candidate.type !== 'wiki.changed' || candidate.scope !== 'content') {
                return;
            }

            if (timeout) {
                clearTimeout(timeout);
            }
            unsubscribe?.();
            resolve(candidate);
        });
    });
}
