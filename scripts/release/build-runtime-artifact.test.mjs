import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    findMissingRuntimeArtifactPaths,
    findUnexpectedRuntimeAssetPaths,
} from './build-runtime-artifact.mjs';

test('compiled Runtime loads package metadata for external dependencies', async () => {
    const source = await fs.readFile(
        path.resolve(import.meta.dirname, 'build-runtime-artifact.mjs'),
        'utf8'
    );

    assert.match(source, /'--compile-autoload-package-json'/u);
});

test('runtime artifact validation catches missing staged SDK', async () => {
    const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grotto-runtime-artifact-'));

    await fs.mkdir(path.join(stageRoot, 'bin'), { recursive: true });
    await fs.writeFile(path.join(stageRoot, 'bin', 'grotto'), '');
    await fs.writeFile(path.join(stageRoot, 'bin', 'grotto-runtime'), '');
    await fs.mkdir(path.join(stageRoot, 'share/grotto/node_modules/@tobilu/qmd'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/grotto/node_modules/@tobilu/qmd/package.json'),
        '{}'
    );
    await fs.mkdir(path.join(stageRoot, 'share/grotto/node_modules/agent-browser/bin'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/grotto/node_modules/agent-browser/bin/agent-browser.js'),
        ''
    );
    await fs.mkdir(path.join(stageRoot, 'share/grotto/runtime-assets/google'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/grotto/runtime-assets/google/oauth-client.json'),
        '{}'
    );

    assert.deepEqual(await findMissingRuntimeArtifactPaths(stageRoot), [
        'share/grotto/node_modules/@tavern/sdk/package.json',
    ]);

    await fs.mkdir(path.join(stageRoot, 'share/grotto/node_modules/@tavern/sdk'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/grotto/node_modules/@tavern/sdk/package.json'),
        '{}'
    );

    assert.deepEqual(await findMissingRuntimeArtifactPaths(stageRoot), []);
});

test('runtime artifact validation rejects unexpected runtime asset roots', async () => {
    const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grotto-runtime-artifact-'));
    const runtimeAssetsRoot = path.join(stageRoot, 'share/grotto/runtime-assets');

    await fs.mkdir(path.join(runtimeAssetsRoot, 'google'), { recursive: true });
    await fs.mkdir(path.join(runtimeAssetsRoot, 'harness-bridges'), { recursive: true });
    await fs.mkdir(path.join(runtimeAssetsRoot, 'legacy-skills/memory'), { recursive: true });
    await fs.writeFile(path.join(runtimeAssetsRoot, 'legacy-skills/memory/SKILL.md'), '');

    assert.deepEqual(await findUnexpectedRuntimeAssetPaths(stageRoot), [
        'share/grotto/runtime-assets/legacy-skills',
    ]);
});
