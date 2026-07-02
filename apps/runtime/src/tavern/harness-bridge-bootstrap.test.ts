import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import { afterEach, describe, expect, it } from 'vitest';
import { withRuntimeBridgeBootstrap } from './harness-bridge-bootstrap.ts';

const originalRuntimeAssetsDir = process.env.TAVERN_RUNTIME_ASSETS_DIR;

afterEach(() => {
    restoreEnv('TAVERN_RUNTIME_ASSETS_DIR', originalRuntimeAssetsDir);
});

describe('harness bridge bootstrap', () => {
    it('loads Codex bridge bootstrap assets from the Runtime asset directory', async () => {
        const assetsDir = await mkdtemp(path.join(os.tmpdir(), 'tavern-runtime-assets-'));
        const bridgeDir = path.join(assetsDir, 'harness-bridges', 'codex');
        await mkdir(bridgeDir, { recursive: true });
        await writeFile(path.join(bridgeDir, 'package.json'), '{"type":"module"}');
        await writeFile(path.join(bridgeDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
        await writeFile(path.join(bridgeDir, 'index.mjs'), 'console.log("bridge")');
        await writeFile(path.join(bridgeDir, 'host-tool-mcp.mjs'), 'console.log("mcp")');
        process.env.TAVERN_RUNTIME_ASSETS_DIR = assetsDir;

        const bootstrap = await withRuntimeBridgeBootstrap(fakeHarness(), 'codex').getBootstrap!();

        expect(bootstrap.harnessId).toBe('codex');
        expect(bootstrap.files).toContainEqual({
            content: '{"type":"module"}',
            path: '/tmp/harness/codex/package.json',
        });
        expect(bootstrap.files).toContainEqual({
            content: 'console.log("bridge")',
            path: '/tmp/harness/codex/bridge.mjs',
        });
        expect(bootstrap.files).toContainEqual({
            content: 'console.log("mcp")',
            path: '/tmp/harness/codex/host-tool-mcp.mjs',
        });
    });
});

function fakeHarness() {
    return {
        builtinTools: {},
        doStart: async () => {
            throw new Error('not used');
        },
        getBootstrap: async () => {
            throw new Error('package bootstrap should not be used');
        },
        harnessId: 'codex',
        lifecycleStateSchema: {} as HarnessV1['lifecycleStateSchema'],
        specificationVersion: 'harness-v1',
        supportsBuiltinToolApprovals: false,
    } as HarnessV1;
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
