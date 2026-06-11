import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('managed Hermes bootstrap', () => {
    const originalHome = process.env.HOME;
    const originalPath = process.env.PATH;
    const originalAutoInstall = process.env.TAVERN_HERMES_AUTO_INSTALL;
    const originalAllowSystem = process.env.TAVERN_HERMES_ALLOW_SYSTEM;
    const originalHermesBin = process.env.TAVERN_HERMES_BIN;
    const originalCommit = process.env.TAVERN_HERMES_COMMIT;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-bootstrap-'));
        process.env.HOME = home;
        process.env.PATH = path.join(home, 'empty-bin');
        process.env.TAVERN_HERMES_AUTO_INSTALL = undefined;
        process.env.TAVERN_HERMES_ALLOW_SYSTEM = undefined;
        process.env.TAVERN_HERMES_BIN = undefined;
        process.env.TAVERN_HERMES_COMMIT = undefined;
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('PATH', originalPath);
        restoreEnv('TAVERN_HERMES_AUTO_INSTALL', originalAutoInstall);
        restoreEnv('TAVERN_HERMES_ALLOW_SYSTEM', originalAllowSystem);
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

    it('returns an existing system binary without installing when system installs are allowed', async () => {
        process.env.TAVERN_HERMES_ALLOW_SYSTEM = '1';
        const systemBinary = path.join(home, '.local', 'bin', 'hermes');
        await writeExecutable(systemBinary);
        const runInstaller = vi.fn();

        const { ensureHermesBinary } = await import('./bootstrap');
        const resolved = await ensureHermesBinary({ runInstaller });

        expect(resolved).toEqual({ binaryPath: systemBinary, tier: 'system' });
        expect(runInstaller).not.toHaveBeenCalled();
    });

    it('ignores system installs by default and installs the managed engine', async () => {
        await writeExecutable(path.join(home, '.local', 'bin', 'hermes'));

        const { ensureHermesBinary, resolveInstalledHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();

        // System binary present but not allowed → not resolved.
        expect(resolveInstalledHermesBinary()).toBeNull();

        const resolved = await ensureHermesBinary({
            runInstaller: async () => {
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(resolved).toEqual({ binaryPath: engineBinaryPath(pin), tier: 'managed' });
    });

    it('installs the managed engine when nothing is found, then resolves it', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, readEngineMarker, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();
        const phases: string[] = [];

        const resolved = await ensureHermesBinary({
            onPhase: (phase) => phases.push(phase),
            runInstaller: async () => {
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(resolved).toEqual({ binaryPath: engineBinaryPath(pin), tier: 'managed' });
        expect(phases).toEqual(['installing', 'installed']);
        expect(readEngineMarker(pin)).toMatchObject({
            binaryPath: engineBinaryPath(pin),
            ref: pin.ref,
        });
    });

    it('force-installs the managed engine even when an allowed system binary exists', async () => {
        process.env.TAVERN_HERMES_ALLOW_SYSTEM = '1';
        await writeExecutable(path.join(home, '.local', 'bin', 'hermes'));

        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();

        const resolved = await ensureHermesBinary({
            forceInstall: true,
            runInstaller: async () => {
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(resolved.tier).toBe('managed');
    });

    it('passes a sandboxed HOME under the engine root to the installer', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, engineRoot, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();
        let observedHome: string | null = null;

        await ensureHermesBinary({
            runInstaller: async (input) => {
                observedHome = input.homeDir;
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(observedHome).not.toBeNull();
        expect(observedHome).toMatch(/[/\\]\.install-home$/);
        expect((observedHome as unknown as string).startsWith(engineRoot())).toBe(true);
        expect(observedHome).not.toBe(home);
    });

    it('passes a persistent interpreter dir that survives the sandbox-HOME cleanup', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, engineRoot, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();
        let observedPythonDir: string | null = null;
        let observedHome: string | null = null;

        await ensureHermesBinary({
            runInstaller: async (input) => {
                observedPythonDir = input.pythonInstallDir;
                observedHome = input.homeDir;
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(observedPythonDir).not.toBeNull();
        expect(observedPythonDir).toMatch(/[/\\]uv-python$/);
        expect((observedPythonDir as unknown as string).startsWith(engineRoot())).toBe(true);
        // Interpreters must not live under the throwaway HOME that gets removed.
        expect(
            (observedPythonDir as unknown as string).startsWith(observedHome as unknown as string)
        ).toBe(false);
    });

    it('treats a managed install with a dangling interpreter as broken and reinstalls it', async () => {
        const { ensureHermesBinary, resolveInstalledHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, resolveHermesPin, writeEngineMarker } = await import('./engine');
        const pin = resolveHermesPin();

        // A completed install whose interpreter target was deleted afterwards.
        await writeExecutable(engineBinaryPath(pin));
        const venvPython = path.join(path.dirname(engineBinaryPath(pin)), 'python');
        await fs.symlink(path.join(home, 'missing-python'), venvPython);
        writeEngineMarker(pin, {
            binaryPath: engineBinaryPath(pin),
            installedAt: new Date().toISOString(),
            installerSource: 'bundled-asset',
            ref: pin.ref,
        });

        expect(resolveInstalledHermesBinary()).toBeNull();

        const resolved = await ensureHermesBinary({
            runInstaller: async () => {
                await fs.rm(venvPython, { force: true });
                await writeFakeEngineInstall(engineBinaryPath(pin));
            },
        });

        expect(resolved).toEqual({ binaryPath: engineBinaryPath(pin), tier: 'managed' });
    });

    it('fails the install when the venv interpreter does not resolve', async () => {
        const { ensureHermesBinary } = await import('./bootstrap');
        const { engineBinaryPath, readEngineMarker, resolveHermesPin } = await import('./engine');
        const pin = resolveHermesPin();

        await expect(
            ensureHermesBinary({
                runInstaller: async () => {
                    await writeExecutable(engineBinaryPath(pin));
                    // Dangling symlink, like a venv pointing at a deleted
                    // uv-managed interpreter.
                    const venvPython = path.join(path.dirname(engineBinaryPath(pin)), 'python');
                    await fs.symlink(path.join(home, 'missing-python'), venvPython);
                },
            })
        ).rejects.toMatchObject({
            code: 'managed_hermes_setup',
            message: expect.stringContaining('Python interpreter does not resolve'),
        });
        expect(readEngineMarker(pin)).toBeNull();
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

    it('error names ALLOW_SYSTEM when auto-install is off and a system install exists', async () => {
        process.env.TAVERN_HERMES_AUTO_INSTALL = '0';
        await writeExecutable(path.join(home, '.local', 'bin', 'hermes'));
        vi.resetModules();
        const runInstaller = vi.fn();

        const { ensureHermesBinary } = await import('./bootstrap');

        await expect(ensureHermesBinary({ runInstaller })).rejects.toMatchObject({
            code: 'managed_hermes_setup',
            message: expect.stringContaining('TAVERN_HERMES_ALLOW_SYSTEM'),
        });
        expect(runInstaller).not.toHaveBeenCalled();
    });

    async function writeExecutable(filePath: string) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, '#!/usr/bin/env bash\n');
        await fs.chmod(filePath, 0o755);
    }

    /** Fake a complete engine install: hermes binary plus a resolvable venv python. */
    async function writeFakeEngineInstall(binaryPath: string) {
        await writeExecutable(binaryPath);
        await writeExecutable(path.join(path.dirname(binaryPath), 'python'));
    }
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
