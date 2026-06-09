import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    engineBinaryPath,
    engineInstallDir,
    engineRoot,
    hermesPinnedCommit,
    readEngineMarker,
    resolveHermesPin,
    writeEngineMarker,
} from './engine';

describe('managed Hermes engine pin and paths', () => {
    const originalHome = process.env.HOME;
    const originalCommit = process.env.TAVERN_HERMES_COMMIT;
    const originalBranch = process.env.TAVERN_HERMES_BRANCH;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-engine-'));
        process.env.HOME = home;
        process.env.TAVERN_HERMES_COMMIT = undefined;
        process.env.TAVERN_HERMES_BRANCH = undefined;
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('TAVERN_HERMES_COMMIT', originalCommit);
        restoreEnv('TAVERN_HERMES_BRANCH', originalBranch);
        await fs.rm(home, { force: true, recursive: true });
    });

    it('resolves the pinned commit by default', () => {
        expect(resolveHermesPin()).toEqual({
            kind: 'commit',
            ref: hermesPinnedCommit,
            source: 'pinned',
        });
    });

    it('prefers TAVERN_HERMES_COMMIT over TAVERN_HERMES_BRANCH and the pin', () => {
        process.env.TAVERN_HERMES_BRANCH = 'main';
        process.env.TAVERN_HERMES_COMMIT = 'abc123';

        expect(resolveHermesPin()).toEqual({ kind: 'commit', ref: 'abc123', source: 'commit-env' });
    });

    it('falls back to TAVERN_HERMES_BRANCH when no commit override exists', () => {
        process.env.TAVERN_HERMES_BRANCH = 'feature/some-branch';

        const pin = resolveHermesPin();
        expect(pin).toEqual({ kind: 'branch', ref: 'feature/some-branch', source: 'branch-env' });
        // Branch separators stay out of the install dir name.
        expect(engineInstallDir(pin)).toBe(
            path.join(home, '.tavern', 'engine', 'feature-some-branch', 'hermes-agent')
        );
    });

    it('derives engine paths under ~/.tavern/engine', () => {
        const pin = resolveHermesPin();

        expect(engineRoot()).toBe(path.join(home, '.tavern', 'engine'));
        expect(engineBinaryPath(pin)).toBe(
            path.join(home, '.tavern', 'engine', pin.ref, 'hermes-agent', 'venv', 'bin', 'hermes')
        );
    });

    it('round-trips the install marker and rejects partial markers', () => {
        const pin = resolveHermesPin();
        expect(readEngineMarker(pin)).toBeNull();

        const marker = {
            binaryPath: engineBinaryPath(pin),
            installedAt: '2026-06-09T00:00:00.000Z',
            installerSource: 'bundled-asset' as const,
            ref: pin.ref,
        };
        writeEngineMarker(pin, marker);

        expect(readEngineMarker(pin)).toEqual(marker);
    });
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        process.env[name] = undefined;
        return;
    }

    process.env[name] = value;
}
