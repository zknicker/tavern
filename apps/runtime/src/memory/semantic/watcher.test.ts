import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeEvent } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { subscribeToRuntimeEvents } from '../../tavern/runtime-events.ts';
import {
    closeSemanticMemoryWatcher,
    getSemanticMemoryWatcherFreshness,
    startSemanticMemoryWatcher,
} from './watcher.ts';

type SemanticMemoryChangedEvent = Extract<AgentRuntimeEvent, { type: 'semanticMemory.changed' }>;

describe('SemanticMemory watcher', () => {
    let root: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-semanticMemory-watcher-'));
    });

    afterEach(async () => {
        await closeSemanticMemoryWatcher();
        await fs.rm(root, { force: true, recursive: true });
    });

    test('publishes changed Markdown paths from the watched root', async () => {
        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await startTestSemanticMemoryWatcher(root);

        const changed = waitForSemanticMemoryChanged();

        await fs.writeFile(path.join(root, 'Projects', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(getSemanticMemoryWatcherFreshness()).toMatchObject({
            live: true,
            state: 'watching',
        });
        expect(event).toMatchObject({
            paths: ['Projects/Alpha.md'],
            reason: 'watch',
            scope: 'content',
            type: 'semanticMemory.changed',
        });
    });

    test('publishes changes when the Memory root is inside a hidden parent', async () => {
        const hiddenRoot = path.join(root, '.owner', 'SemanticMemory');
        await fs.mkdir(hiddenRoot, { recursive: true });
        await startTestSemanticMemoryWatcher(hiddenRoot);

        const changed = waitForSemanticMemoryChanged();

        await fs.writeFile(path.join(hiddenRoot, 'Notes.md'), '# Notes\n');

        const event = await changed;

        expect(event.paths).toEqual(['Notes.md']);
    });

    test('publishes changed Markdown paths inside dotted folder names', async () => {
        await fs.mkdir(path.join(root, 'Projects', '2026.06'), { recursive: true });
        await startTestSemanticMemoryWatcher(root);

        const changed = waitForSemanticMemoryChanged();

        await fs.writeFile(path.join(root, 'Projects', '2026.06', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Projects/2026.06/Alpha.md']);
    });

    test('publishes changed Markdown paths when the Memory root is a symlink', async () => {
        const targetRoot = path.join(root, 'TargetSemanticMemory');
        const linkRoot = path.join(root, 'LinkedSemanticMemory');
        await fs.mkdir(targetRoot, { recursive: true });
        await fs.symlink(targetRoot, linkRoot, 'dir');
        await startTestSemanticMemoryWatcher(linkRoot);

        const changed = waitForSemanticMemoryChanged();

        await fs.writeFile(path.join(targetRoot, 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Alpha.md']);
    });

    test('publishes a coarse update for folder-only changes', async () => {
        await startTestSemanticMemoryWatcher(root);

        const changed = waitForSemanticMemoryChanged();

        await fs.mkdir(path.join(root, 'Projects'));

        const event = await changed;

        expect(event).toMatchObject({
            paths: [],
            reason: 'bulk',
            scope: 'content',
        });
    });
});

async function startTestSemanticMemoryWatcher(memoryPath: string) {
    await startSemanticMemoryWatcher(() => ({ memoryPath }), {
        pollIntervalMs: 50,
        usePolling: true,
    });
}

function waitForSemanticMemoryChanged() {
    let unsubscribe: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return new Promise<SemanticMemoryChangedEvent>((resolve, reject) => {
        timeout = setTimeout(() => {
            unsubscribe?.();
            reject(new Error('Timed out waiting for SemanticMemory watcher event.'));
        }, 5000);
        unsubscribe = subscribeToRuntimeEvents((candidate) => {
            if (candidate.type !== 'semanticMemory.changed' || candidate.scope !== 'content') {
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
