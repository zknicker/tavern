import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('managed Hermes supervisor', () => {
    const originalHome = process.env.HOME;
    const originalHermesBin = process.env.TAVERN_HERMES_BIN;
    const originalPath = process.env.PATH;
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-home-'));
        process.env.HOME = home;
        process.env.PATH = '/usr/bin:/bin';
        process.env.TAVERN_RUNTIME_ROOT = path.join(home, 'runtime');
        process.env.TAVERN_HERMES_BIN = undefined;
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('PATH', originalPath);
        restoreEnv('TAVERN_HERMES_BIN', originalHermesBin);
        restoreEnv('TAVERN_RUNTIME_ROOT', originalRuntimeRoot);
        vi.resetModules();
        await fs.rm(home, { force: true, recursive: true });
    });

    it('resolves the official installer binary outside shell PATH', async () => {
        const binaryPath = path.join(home, '.local', 'bin', 'hermes');
        await fs.mkdir(path.dirname(binaryPath), { recursive: true });
        await fs.writeFile(binaryPath, '#!/usr/bin/env bash\n');
        await fs.chmod(binaryPath, 0o755);

        const { resolveHermesBinary } = await import('./supervisor');

        expect(resolveHermesBinary()).toBe(binaryPath);
    });

    it('expands a configured Hermes binary path', async () => {
        const binaryPath = path.join(home, '.hermes', 'bin', 'hermes');
        await fs.mkdir(path.dirname(binaryPath), { recursive: true });
        await fs.writeFile(binaryPath, '#!/usr/bin/env bash\n');
        await fs.chmod(binaryPath, 0o755);
        process.env.TAVERN_HERMES_BIN = '~/.hermes/bin/hermes';
        vi.resetModules();

        const { resolveHermesBinary } = await import('./supervisor');

        expect(resolveHermesBinary()).toBe(path.join(home, '.hermes', 'bin', 'hermes'));
    });

    it('fails clearly when no Hermes binary is installed', async () => {
        process.env.PATH = path.join(home, 'empty-bin');
        vi.resetModules();

        const { resolveHermesBinary } = await import('./supervisor');

        expect(() => resolveHermesBinary()).toThrow(/agent engine is not installed/u);
    });

    it('enables the Hermes dashboard cron ticker for managed launches', async () => {
        const { buildHermesDashboardEnv } = await import('./supervisor');

        expect(buildHermesDashboardEnv()).toMatchObject({
            HERMES_DESKTOP: '1',
        });
    });
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
