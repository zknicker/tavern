import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeEvent } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events.ts';
import { closeVaultWatcher, getVaultWatcherFreshness, startVaultWatcher } from './watcher.ts';

type VaultChangedEvent = Extract<AgentRuntimeEvent, { type: 'vault.changed' }>;

describe('Vault watcher', () => {
    let root: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-vault-watcher-'));
    });

    afterEach(async () => {
        await closeVaultWatcher();
        await fs.rm(root, { force: true, recursive: true });
    });

    test('publishes changed Markdown paths from the watched root', async () => {
        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await startTestVaultWatcher(root);

        const changed = waitForVaultChanged();

        await fs.writeFile(path.join(root, 'Projects', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(getVaultWatcherFreshness()).toMatchObject({
            live: true,
            state: 'watching',
        });
        expect(event).toMatchObject({
            paths: ['Projects/Alpha.md'],
            reason: 'watch',
            scope: 'content',
            type: 'vault.changed',
        });
    });

    test('publishes changes when the Memory root is inside a hidden parent', async () => {
        const hiddenRoot = path.join(root, '.owner', 'Vault');
        await fs.mkdir(hiddenRoot, { recursive: true });
        await startTestVaultWatcher(hiddenRoot);

        const changed = waitForVaultChanged();

        await fs.writeFile(path.join(hiddenRoot, 'Notes.md'), '# Notes\n');

        const event = await changed;

        expect(event.paths).toEqual(['Notes.md']);
    });

    test('publishes changed Markdown paths inside dotted folder names', async () => {
        await fs.mkdir(path.join(root, 'Projects', '2026.06'), { recursive: true });
        await startTestVaultWatcher(root);

        const changed = waitForVaultChanged();

        await fs.writeFile(path.join(root, 'Projects', '2026.06', 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Projects/2026.06/Alpha.md']);
    });

    test('publishes changed Markdown paths when the Memory root is a symlink', async () => {
        const targetRoot = path.join(root, 'TargetVault');
        const linkRoot = path.join(root, 'LinkedVault');
        await fs.mkdir(targetRoot, { recursive: true });
        await fs.symlink(targetRoot, linkRoot, 'dir');
        await startTestVaultWatcher(linkRoot);

        const changed = waitForVaultChanged();

        await fs.writeFile(path.join(targetRoot, 'Alpha.md'), '# Alpha\n');

        const event = await changed;

        expect(event.paths).toEqual(['Alpha.md']);
    });

    test('publishes a coarse update for folder-only changes', async () => {
        await startTestVaultWatcher(root);

        const changed = waitForVaultChanged();

        await fs.mkdir(path.join(root, 'Projects'));

        const event = await changed;

        expect(event).toMatchObject({
            paths: [],
            reason: 'bulk',
            scope: 'content',
        });
    });
});

async function startTestVaultWatcher(vaultPath: string) {
    await startVaultWatcher(() => ({ vaultPath }), {
        pollIntervalMs: 50,
        usePolling: true,
    });
}

function waitForVaultChanged() {
    let unsubscribe: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return new Promise<VaultChangedEvent>((resolve, reject) => {
        timeout = setTimeout(() => {
            unsubscribe?.();
            reject(new Error('Timed out waiting for Vault watcher event.'));
        }, 5000);
        unsubscribe = subscribeToRuntimeEvents((candidate) => {
            if (candidate.type !== 'vault.changed' || candidate.scope !== 'content') {
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
