import { describe, expect, test } from 'vitest';
import type { Brew, BrewResult } from './brew';
import { runRestartFlow } from './restart-flow';
import type { RuntimeProbe } from './runtime-probe';

function ok(stdout = ''): BrewResult {
    return { code: 0, stdout, stderr: '', missing: false };
}

function fakeBrew(overrides: Partial<Brew> = {}): Brew {
    return {
        isAvailable: () => true,
        update: () => ok(),
        upgradeRuntime: () => ok(),
        isRuntimeOutdated: () => true,
        servicesRestartRuntime: () => ok(),
        servicesInfoRuntimeJson: () => ok('{"status":"error"}'),
        ...overrides,
    };
}

/** Probe that returns the given health sequence, then sticks on the last value. */
function sequencedProbe(healthSeq: boolean[], version: string | null): RuntimeProbe {
    let index = 0;
    return {
        health: () => {
            const value = healthSeq[Math.min(index, healthSeq.length - 1)] ?? false;
            index += 1;
            return Promise.resolve(value);
        },
        currentVersion: () => Promise.resolve(version),
    };
}

/** Fake clock that advances by the poll interval on each sleep. */
function fakeClock() {
    let time = 0;
    return {
        now: () => time,
        sleep: (ms: number) => {
            time += ms;
            return Promise.resolve();
        },
    };
}

function outText(lines: { text: string; stream: string }[]): string {
    return lines.map((line) => line.text).join('\n');
}

describe('runRestartFlow', () => {
    test('brew missing → exit 1', async () => {
        const clock = fakeClock();
        const result = await runRestartFlow(
            {
                brew: fakeBrew({ isAvailable: () => false }),
                probe: sequencedProbe([true], '1.4.2'),
                ...clock,
            },
            { noWait: false }
        );
        expect(result.exitCode).toBe(1);
        expect(outText(result.lines)).toContain('Homebrew is required to restart the Runtime.');
    });

    test('restart success after a few unhealthy polls', async () => {
        const clock = fakeClock();
        const result = await runRestartFlow(
            { brew: fakeBrew(), probe: sequencedProbe([false, false, true], '1.4.2'), ...clock },
            { noWait: false }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Runtime healthy · v1.4.2');
    });

    test('restart timeout → exit 1 with service state and log hint', async () => {
        const clock = fakeClock();
        const result = await runRestartFlow(
            { brew: fakeBrew(), probe: sequencedProbe([false], null), ...clock },
            { noWait: false }
        );
        expect(result.exitCode).toBe(1);
        expect(outText(result.lines)).toContain('did not become healthy within 60s');
        expect(outText(result.lines)).toContain('"status":"error"');
        expect(outText(result.lines)).toContain('Check the service log');
    });

    test('--no-wait skips health polling and reports request', async () => {
        const clock = fakeClock();
        const result = await runRestartFlow(
            { brew: fakeBrew(), probe: sequencedProbe([false], null), ...clock },
            { noWait: true }
        );
        expect(result.exitCode).toBe(0);
        expect(outText(result.lines)).toContain('Skipping health wait (--no-wait).');
        expect(outText(result.lines)).not.toContain('healthy');
    });

    test('brew restart command failure → exit 1, no health claim', async () => {
        const clock = fakeClock();
        const result = await runRestartFlow(
            {
                brew: fakeBrew({
                    servicesRestartRuntime: () => ({
                        code: 1,
                        stdout: '',
                        stderr: 'no service',
                        missing: false,
                    }),
                }),
                probe: sequencedProbe([true], '1.4.2'),
                ...clock,
            },
            { noWait: false }
        );
        expect(result.exitCode).toBe(1);
        expect(outText(result.lines)).toContain('Homebrew failed to restart the Runtime service.');
        expect(outText(result.lines)).toContain('no service');
        expect(outText(result.lines)).not.toContain('healthy');
    });
});
