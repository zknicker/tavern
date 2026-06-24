import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ensureManagedMerchbaseToolsetPlugin,
    merchbaseToolsetPluginSource,
} from './merchbase-toolset-plugin';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(
        tempDirs.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true }))
    );
});

describe('managed MerchBase toolset plugin', () => {
    it('registers read-only MerchBase tools under the merchbase toolset', () => {
        const source = merchbaseToolsetPluginSource();

        expect(source).toContain('ctx.register_tool(');
        expect(source).toContain('ctx.register_skill(');
        expect(source).toContain('"merchbase:merchbase"');
        expect(source).toContain('toolset=TOOLSET');
        expect(source).toContain('TOOLSET = "merchbase"');
        expect(source).toContain('load the {GUIDANCE_SKILL} skill');
        expect(source).toContain('settings.get("enabled") and settings.get("apiKeyConfigured")');
        expect(source).toContain('merchbase_sales_summary');
        expect(source).toContain('merchbase_sales_series');
        expect(source).toContain('merchbase_products_search');
        expect(source).toContain('merchbase_designs_list');
        expect(source).not.toMatch(/\b(sync|ripcord|ingestion)\b/iu);
    });

    it('installs the plugin into the managed Hermes plugin directory', async () => {
        const hermesHome = await makeTempDir();

        const { pluginDir, skillPath } = await ensureManagedMerchbaseToolsetPlugin({ hermesHome });
        const manifest = await fs.readFile(path.join(pluginDir, 'plugin.yaml'), 'utf8');
        const sourcePath = path.join(pluginDir, '__init__.py');
        const source = await fs.readFile(sourcePath, 'utf8');
        const skill = await fs.readFile(skillPath, 'utf8');

        expect(pluginDir).toBe(path.join(hermesHome, 'plugins', 'merchbase'));
        expect(manifest).toContain('name: merchbase');
        expect(manifest).toContain('provides_tools:');
        expect(manifest).toContain('  - merchbase_sales_series');
        expect(source).toContain('def register(ctx) -> None:');
        expect(skillPath).toBe(path.join(pluginDir, 'skills', 'merchbase', 'SKILL.md'));
        expect(skill).toContain('name: merchbase');
        expect(skill).toContain('MerchBaseSalesChart');

        const compile = spawnSync('python3', ['-m', 'py_compile', sourcePath], {
            encoding: 'utf8',
        });
        if (!compile.error) {
            expect(compile.status, compile.stderr).toBe(0);
        }
    });
});

async function makeTempDir() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'merchbase-plugin-'));
    tempDirs.push(directory);
    return directory;
}
