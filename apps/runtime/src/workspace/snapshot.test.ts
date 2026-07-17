import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureWorkspaceSnapshot, diffWorkspaceSnapshots } from './snapshot';

describe('workspace snapshot', () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(tmpdir(), 'tavern-snapshot-'));
    });

    afterEach(async () => {
        await rm(root, { force: true, recursive: true });
    });

    it('detects created, modified, and deleted files with line counts', async () => {
        await writeFile(path.join(root, 'NOTES.md'), 'one\ntwo\n');
        await writeFile(path.join(root, 'gone.md'), 'obsolete\n');
        const before = await captureWorkspaceSnapshot(root);

        await writeFile(path.join(root, 'NOTES.md'), 'one\nchanged\nthree\n');
        await rm(path.join(root, 'gone.md'));
        await mkdir(path.join(root, 'workbench'));
        await writeFile(path.join(root, 'workbench', 'out.txt'), 'a\nb\n');
        const after = await captureWorkspaceSnapshot(root);

        const changes = diffWorkspaceSnapshots(before, after);
        expect(changes.map((change) => [change.path, change.change])).toEqual([
            ['NOTES.md', 'modified'],
            ['gone.md', 'deleted'],
            ['workbench/out.txt', 'created'],
        ]);

        const modified = changes[0];
        expect(modified?.beforeText).toBe('one\ntwo\n');
        expect(modified?.afterText).toBe('one\nchanged\nthree\n');
        expect(modified?.additions).toBe(2);
        expect(modified?.deletions).toBe(1);

        const deleted = changes[1];
        expect(deleted?.afterText).toBeNull();
        expect(deleted?.deletions).toBe(1);

        const created = changes[2];
        expect(created?.beforeText).toBeNull();
        expect(created?.additions).toBe(2);
    });

    it('reports unchanged workspaces as empty change sets', async () => {
        await writeFile(path.join(root, 'NOTES.md'), 'steady\n');
        const before = await captureWorkspaceSnapshot(root);
        const after = await captureWorkspaceSnapshot(root);
        expect(diffWorkspaceSnapshots(before, after)).toEqual([]);
    });

    it('marks binary files changed without retaining content', async () => {
        await writeFile(path.join(root, 'art.png'), Buffer.from([0, 1, 2, 3, 255]));
        const before = await captureWorkspaceSnapshot(root);
        await writeFile(path.join(root, 'art.png'), Buffer.from([0, 9, 9, 9, 255, 12]));
        const after = await captureWorkspaceSnapshot(root);

        const changes = diffWorkspaceSnapshots(before, after);
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            afterText: null,
            beforeText: null,
            change: 'modified',
            omitted: 'binary',
            path: 'art.png',
        });
    });

    it('never snapshots hidden, skipped, sensitive, or engine-managed paths', async () => {
        await mkdir(path.join(root, '.claude'));
        await writeFile(path.join(root, '.claude', 'credentials.json'), 'secret');
        await mkdir(path.join(root, 'node_modules'));
        await writeFile(path.join(root, 'node_modules', 'dep.js'), 'x');
        await writeFile(path.join(root, '.env'), 'KEY=1');
        // The harness CLI tool-relay shim is rewritten with a fresh port and
        // token around turns; it must never read as agent file work.
        await writeFile(path.join(root, 'harness-tool.mjs'), 'const token = "rotates";\n');
        await writeFile(path.join(root, 'visible.md'), 'hello\n');

        const snapshot = await captureWorkspaceSnapshot(root);
        expect([...snapshot.entries.keys()]).toEqual(['visible.md']);
    });
});
