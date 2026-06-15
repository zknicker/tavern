import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    prepareManagedWikiIntegration,
    resolveManagedWikiHubPath,
    resolveRuntimeAssetsRoot,
} from './managed-wiki';

describe('managed wiki integration', () => {
    it('materializes the managed skill and hub skeleton', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-managed-wiki-'));
        const assetsRoot = path.join(directory, 'assets');
        const hermesHome = path.join(directory, 'hermes-home');
        const runtimeRoot = path.join(directory, 'runtime-root');
        const sourceSkill = path.join(assetsRoot, 'hermes', 'skills', 'wiki');

        await writeFile(path.join(sourceSkill, 'SKILL.md'), '---\nname: wiki\n---\n\nWiki body.\n');
        await writeFile(path.join(sourceSkill, 'references', 'ingestion.md'), '# Ingestion\n');

        const integration = await prepareManagedWikiIntegration({
            assetsRoot,
            hermesHome,
            runtimeRoot,
        });

        await expect(
            fs.readFile(path.join(integration.skillPath, 'SKILL.md'), 'utf8')
        ).resolves.toContain('Wiki body.');
        await expect(
            fs.readFile(path.join(integration.skillPath, 'references', 'ingestion.md'), 'utf8')
        ).resolves.toContain('Ingestion');
        expect((await fs.stat(path.join(integration.hubPath, 'topics'))).isDirectory()).toBe(true);
        await expect(
            fs.readFile(path.join(integration.hubPath, 'wikis.json'), 'utf8')
        ).resolves.toContain('"local_wikis": []');
    });

    it('defaults the wiki hub to the Tavern Runtime root', () => {
        const previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        const previousCortexWikiPath = process.env.TAVERN_CORTEX_WIKI_PATH;
        try {
            process.env.TAVERN_WIKI_HUB_PATH = undefined;
            process.env.TAVERN_CORTEX_WIKI_PATH = undefined;

            expect(resolveManagedWikiHubPath('/tmp/tavern-runtime')).toBe(
                '/tmp/tavern-runtime/wiki'
            );
        } finally {
            restoreEnv('TAVERN_WIKI_HUB_PATH', previousHubPath);
            restoreEnv('TAVERN_CORTEX_WIKI_PATH', previousCortexWikiPath);
        }
    });

    it('finds repo runtime assets from source execution', () => {
        const previousAssetsDir = process.env.TAVERN_RUNTIME_ASSETS_DIR;
        try {
            process.env.TAVERN_RUNTIME_ASSETS_DIR = undefined;

            expect(resolveRuntimeAssetsRoot()).toMatch(/apps\/runtime\/assets$/u);
        } finally {
            restoreEnv('TAVERN_RUNTIME_ASSETS_DIR', previousAssetsDir);
        }
    });
});

async function writeFile(filePath: string, content: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        unsetEnv(key);
        return;
    }
    process.env[key] = value;
}

function unsetEnv(key: string) {
    Reflect.deleteProperty(process.env, key);
}
