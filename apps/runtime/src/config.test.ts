import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime config paths', () => {
    const originalHome = process.env.HOME;
    const originalHermesHome = process.env.TAVERN_HERMES_HOME;
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-config-home-'));
        process.env.HOME = home;
        process.env.TAVERN_RUNTIME_ROOT = path.join(home, 'runtime');
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('TAVERN_HERMES_HOME', originalHermesHome);
        restoreEnv('TAVERN_RUNTIME_ROOT', originalRuntimeRoot);
        vi.resetModules();
        await fs.rm(home, { force: true, recursive: true });
    });

    it('expands a configured Hermes home path under the user home', async () => {
        process.env.TAVERN_HERMES_HOME = '~/.tavern-hermes/runtime/hermes/home';
        vi.resetModules();

        const config = await import('./config');

        expect(config.HERMES_HOME).toBe(
            path.join(home, '.tavern-hermes', 'runtime', 'hermes', 'home')
        );
    });
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
