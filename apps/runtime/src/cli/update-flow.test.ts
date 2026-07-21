import { describe, expect, test } from 'vitest';
import type { Brew, BrewResult } from './brew';
import type { RuntimeProbe } from './runtime-probe';
import { runUpdateFlow } from './update-flow';

function ok(stdout = ''): BrewResult {
    return { code: 0, stdout, stderr: '', missing: false };
}

function fail(stderr = 'boom'): BrewResult {
    return { code: 1, stdout: '', stderr, missing: false };
}

function fakeBrew(overrides: Partial<Brew> = {}): Brew {
    return {
        isAvailable: () => true,
        update: () => ok(),
        upgradeRuntime: () => ok(),
        isRuntimeOutdated: () => true,
        servicesRestartRuntime: () => ok(),
        servicesInfoRuntimeJson: () => ok('{}'),
        ...overrides,
    };
}

function fakeProbe(version: string | null, healthy = true): RuntimeProbe {
    return {
        health: () => Promise.resolve(healthy),
        currentVersion: () => Promise.resolve(version),
    };
}

const baseDeps = {
    stagedVersion: () => Promise.resolve('1.4.2'),
    stageEngine: () => Promise.resolve(true),
};

function outText(lines: { text: string; stream: string }[]): string {
    return lines.map((line) => line.text).join('\n');
}

describe('runUpdateFlow', () => {
    test('brew missing → exit 1 with friendly error', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ isAvailable: () => false }),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(1);
        expect(outText(result.lines)).toContain('Homebrew is required to update the Runtime.');
        expect(result.lines.at(-1)?.stream).toBe('err');
    });

    test('brew upgrade fails → exit 1, captured output shown', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ upgradeRuntime: () => fail('formula error') }),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(1);
        expect(outText(result.lines)).toContain('Homebrew failed to stage the Runtime upgrade.');
        expect(outText(result.lines)).toContain('formula error');
    });

    test('up-to-date: still probes running version and reports match', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ isRuntimeOutdated: () => false }),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Already up to date (v1.4.2)');
        expect(outText(result.lines)).toContain('Runtime is up to date and running v1.4.2.');
        expect(result.shouldRestart).toBe(false);
    });

    test('emits phase progress before slow update work', async () => {
        const progress: string[] = [];
        const result = await runUpdateFlow(
            {
                brew: fakeBrew(),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            {
                restart: false,
                verbose: false,
                onProgress: (line) => progress.push(line.text),
            }
        );

        expect(progress).toEqual([
            'Checking Homebrew...',
            'Checking Grotto Runtime formula...',
            'Updating Homebrew metadata...',
            'Staging Grotto Runtime package...',
            'Pre-staging agent engine...',
            'Reading staged Runtime version...',
            'Checking running Runtime version...',
        ]);
        expect(result.progressLineCount).toBe(progress.length);
        expect(result.lines.slice(0, result.progressLineCount).map((line) => line.text)).toEqual(
            progress
        );
    });

    test('up-to-date formula but running OLD process → staged-but-running-old verdict', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ isRuntimeOutdated: () => false }),
                probe: fakeProbe('1.4.0'),
                ...baseDeps,
            },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Already up to date (v1.4.2)');
        expect(outText(result.lines)).toContain('Staged v1.4.2 — runtime is still running v1.4.0.');
        expect(outText(result.lines)).toContain("Run 'grotto restart' to cut over.");
        expect(result.shouldRestart).toBe(false);
    });

    test('runtime not running → start hint, exit 0', async () => {
        const result = await runUpdateFlow(
            { brew: fakeBrew(), probe: fakeProbe(null), ...baseDeps },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain(
            "Staged v1.4.2. Runtime is not running — start it with 'brew services start grotto-runtime'."
        );
        expect(result.shouldRestart).toBe(false);
    });

    test('staged-not-restarted with --restart → shouldRestart true', async () => {
        const result = await runUpdateFlow(
            { brew: fakeBrew(), probe: fakeProbe('1.4.0'), ...baseDeps },
            { restart: true, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Staged v1.4.2 — runtime is still running v1.4.0.');
        expect(result.shouldRestart).toBe(true);
        expect(outText(result.lines)).not.toContain("Run 'grotto restart' to cut over.");
    });

    test('versions equal → up-to-date-and-running verdict', async () => {
        const result = await runUpdateFlow(
            { brew: fakeBrew(), probe: fakeProbe('1.4.2'), ...baseDeps },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Runtime is up to date and running v1.4.2.');
    });

    test('engine pre-stage failure only warns, flow continues', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew(),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
                stageEngine: () => Promise.resolve(false),
            },
            { restart: false, verbose: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('agent engine pre-stage failed');
        expect(outText(result.lines)).toContain('Runtime is up to date and running v1.4.2.');
    });

    test('captured brew output hidden without --verbose on success', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ update: () => ok('noisy update log') }),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            { restart: false, verbose: false }
        );
        expect(outText(result.lines)).not.toContain('noisy update log');
    });

    test('captured brew output shown with --verbose', async () => {
        const result = await runUpdateFlow(
            {
                brew: fakeBrew({ update: () => ok('noisy update log') }),
                probe: fakeProbe('1.4.2'),
                ...baseDeps,
            },
            { restart: false, verbose: true }
        );
        expect(outText(result.lines)).toContain('noisy update log');
    });
});
