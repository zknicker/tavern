import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCliCommand } from './cli-command.ts';

const roots: string[] = [];
const originalPath = process.env.PATH;

afterEach(async () => {
    process.env.PATH = originalPath;
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('CLI command resolution', () => {
    it('resolves provider commands from PATH', async () => {
        const root = await mkdtemp(path.join(tmpdir(), 'tavern-cli-bin-'));
        roots.push(root);
        const command = path.join(root, 'claude');
        await writeFile(command, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        process.env.PATH = root;

        expect(resolveCliCommand('claude')).toBe(await realpath(command));
    });

    it('returns null for missing provider commands', () => {
        process.env.PATH = '';

        expect(resolveCliCommand('tavern-missing-provider-cli')).toBeNull();
    });
});
