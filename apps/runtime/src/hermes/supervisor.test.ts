import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('managed Hermes binary resolution', () => {
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
        await writeExecutable(binaryPath);

        const { resolveInstalledHermesBinary } = await import('./bootstrap');

        expect(resolveInstalledHermesBinary()).toEqual({ binaryPath, tier: 'system' });
    });

    it('expands a configured Hermes binary path', async () => {
        const binaryPath = path.join(home, '.hermes', 'bin', 'hermes');
        await writeExecutable(binaryPath);
        process.env.TAVERN_HERMES_BIN = '~/.hermes/bin/hermes';
        vi.resetModules();

        const { resolveInstalledHermesBinary } = await import('./bootstrap');

        expect(resolveInstalledHermesBinary()).toEqual({ binaryPath, tier: 'configured' });
    });

    it('prefers the Tavern-managed engine install over system installs', async () => {
        const systemBinary = path.join(home, '.local', 'bin', 'hermes');
        await writeExecutable(systemBinary);

        const engine = await import('./engine');
        const pin = engine.resolveHermesPin();
        const managedBinary = engine.engineBinaryPath(pin);
        await writeExecutable(managedBinary);
        engine.writeEngineMarker(pin, {
            binaryPath: managedBinary,
            installedAt: new Date().toISOString(),
            installerSource: 'bundled-asset',
            ref: pin.ref,
        });

        const { resolveInstalledHermesBinary } = await import('./bootstrap');

        expect(resolveInstalledHermesBinary()).toEqual({
            binaryPath: managedBinary,
            tier: 'managed',
        });
    });

    it('returns null when no Hermes binary is installed', async () => {
        process.env.PATH = path.join(home, 'empty-bin');
        vi.resetModules();

        const { resolveInstalledHermesBinary } = await import('./bootstrap');

        expect(resolveInstalledHermesBinary()).toBeNull();
    });

    it('enables the Hermes dashboard cron ticker for managed launches', async () => {
        const { buildHermesDashboardEnv } = await import('./supervisor');

        expect(buildHermesDashboardEnv()).toMatchObject({
            HERMES_DESKTOP: '1',
        });
    });

    it('strips PYTHONPATH from the managed dashboard environment', async () => {
        process.env.PYTHONPATH = '/somewhere/site-packages';
        vi.resetModules();
        try {
            const { buildHermesDashboardEnv } = await import('./supervisor');

            // spawn() omits env keys whose value is undefined.
            expect(buildHermesDashboardEnv().PYTHONPATH).toBeUndefined();
        } finally {
            process.env.PYTHONPATH = undefined;
        }
    });
});

async function writeExecutable(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '#!/usr/bin/env bash\n');
    await fs.chmod(filePath, 0o755);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
