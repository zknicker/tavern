import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('managed Hermes bootstrap', () => {
    const originalHome = process.env.HOME;
    const originalPath = process.env.PATH;
    const originalAutoInstall = process.env.TAVERN_HERMES_AUTO_INSTALL;
    const originalHermesBin = process.env.TAVERN_HERMES_BIN;
    const originalCommit = process.env.TAVERN_HERMES_COMMIT;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-bootstrap-'));
        process.env.HOME = home;
        process.env.PATH = path.join(home, 'empty-bin');
        process.env.TAVERN_HERMES_AUTO_INSTALL = undefined;
        process.env.TAVERN_HERMES_BIN = undefined;
        process.env.TAVERN_HERMES_COMMIT = undefined;
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('PATH', originalPath);
        restoreEnv('TAVERN_HERMES_AUTO_INSTALL', originalAutoInstall);
        restoreEnv('TAVERN_HERMES_BIN', originalHermesBin);
        restoreEnv('TAVERN_HERMES_COMMIT', originalCommit);
        vi.resetModules();
        await fs.rm(home, { force: true, recursive: true });
    });

    it('builds exact installer args for a commit pin', async () => {
        const { buildHermesInstallArgs } = await import('./bootstrap');
        const { engineInstallDir } = await import('./engine');
        const pin = { kind: 'commit' as const, ref: 'abc123', source: 'pinned' as const };

        expect(buildHermesInstallArgs({ hermesHome: '/managed/home', pin })).toEqual([
            '--dir',
            engineInstallDir(pin),
            '--hermes-home',
            '/managed/home',
            '--commit',
            'abc123',
            '--non-interactive',
            '--skip-setup',
            '--no-skills',
            '--skip-browser',
        ]);
    });

    it('builds installer args with --branch for a branch pin', async () => {
        const { buildHermesInstallArgs } = await import('./bootstrap');
        const pin = { kind: 'branch' as const, ref: 'main', source: 'branch-env' as const };

        expect(buildHermesInstallArgs({ hermesHome: '/managed/home', pin })).toContain('--branch');
        expect(buildHermesInstallArgs({ hermesHome: '/managed/home', pin })).not.toContain(
            '--commit'
        );
    });

    it('returns an existing system binary without installing', async () => {
        const systemBinary = path.join(home, '.local', 'bin', 'hermes');
        await writeExecutable(systemBinary);
        const runInstaller = vi.fn();

        const { ensureHermesBinary } = await import('./bootstrap');
        const resolved = await ensureHermesBinary({ runInstaller });

        expect(resolved).toEqual({ binaryPath: systemBinary, tier: 'system' });
        expect(runInstaller).not.toHaveBeenCalled();
    });

    it('installs the managed engine when nothing is found, then resolves it', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, readEngineMarker, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();
        const phases: string[] = [];

        const resolved = await ensureHermesBinary({
            onPhase: (phase) => phases.push(phase),
            runInstaller: async () => {
                await writeExecutable(engineBinaryPath(pin));
            },
        });

        expect(resolved).toEqual({ binaryPath: engineBinaryPath(pin), tier: 'managed' });
        expect(phases).toEqual(['installing', 'installed']);
        expect(readEngineMarker(pin)).toMatchObject({
            binaryPath: engineBinaryPath(pin),
            ref: pin.ref,
        });
    });

    it('force-installs the managed engine even when a system binary exists', async () => {
        await writeExecutable(path.join(home, '.local', 'bin', 'hermes'));

        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();

        const resolved = await ensureHermesBinary({
            forceInstall: true,
            runInstaller: async () => {
                await writeExecutable(engineBinaryPath(pin));
            },
        });

        expect(resolved.tier).toBe('managed');
    });

    it('fails with a setup error when the installer leaves no executable binary', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');

        await expect(
            ensureHermesBinary({ runInstaller: async () => undefined })
        ).rejects.toMatchObject({
            code: 'managed_hermes_setup',
            message: expect.stringContaining('could not set up the agent engine'),
        });
    });

    it('refuses to install when TAVERN_HERMES_AUTO_INSTALL=0', async () => {
        process.env.TAVERN_HERMES_AUTO_INSTALL = '0';
        vi.resetModules();
        const runInstaller = vi.fn();

        const { ensureHermesBinary } = await import('./bootstrap');

        await expect(ensureHermesBinary({ runInstaller })).rejects.toMatchObject({
            code: 'managed_hermes_setup',
            message: expect.stringContaining('automatic setup is disabled'),
        });
        expect(runInstaller).not.toHaveBeenCalled();
    });

    async function writeExecutable(filePath: string) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, '#!/usr/bin/env bash\n');
        await fs.chmod(filePath, 0o755);
    }
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
