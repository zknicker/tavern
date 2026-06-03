import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ensureCortexFilesystem } from './filesystem';

describe('Cortex filesystem bootstrap', () => {
    let runtimeRoot: string;
    const originalWikiPath = process.env.TAVERN_CORTEX_WIKI_PATH;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-filesystem-'));
    });

    afterEach(async () => {
        process.env.TAVERN_CORTEX_WIKI_PATH = originalWikiPath;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('creates the configured Cortex wiki directory', async () => {
        const wikiPath = path.join(runtimeRoot, 'cortex', 'wiki');
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;

        ensureCortexFilesystem();

        expect((await stat(wikiPath)).isDirectory()).toBe(true);
    });

    test('does not block Runtime startup when the wiki path cannot be created', async () => {
        const wikiPath = path.join(runtimeRoot, 'cortex-wiki-file');
        await writeFile(wikiPath, 'not a directory');
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;

        expect(() => ensureCortexFilesystem()).not.toThrow();
    });
});
