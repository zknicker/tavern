import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findMissingRuntimeArtifactPaths } from './build-runtime-artifact.mjs';

test('runtime artifact validation catches missing staged SDK', async () => {
    const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-runtime-artifact-'));

    await fs.mkdir(path.join(stageRoot, 'bin'), { recursive: true });
    await fs.writeFile(path.join(stageRoot, 'bin', 'tavern'), '');
    await fs.writeFile(path.join(stageRoot, 'bin', 'tavern-runtime'), '');
    await fs.mkdir(path.join(stageRoot, 'share/tavern/node_modules/@tobilu/qmd'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/tavern/node_modules/@tobilu/qmd/package.json'),
        '{}'
    );
    await fs.mkdir(path.join(stageRoot, 'share/tavern/runtime-assets/google'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/tavern/runtime-assets/google/oauth-client.json'),
        '{}'
    );

    assert.deepEqual(await findMissingRuntimeArtifactPaths(stageRoot), [
        'share/tavern/node_modules/@tavern/sdk/package.json',
    ]);

    await fs.mkdir(path.join(stageRoot, 'share/tavern/node_modules/@tavern/sdk'), {
        recursive: true,
    });
    await fs.writeFile(
        path.join(stageRoot, 'share/tavern/node_modules/@tavern/sdk/package.json'),
        '{}'
    );

    assert.deepEqual(await findMissingRuntimeArtifactPaths(stageRoot), []);
});
