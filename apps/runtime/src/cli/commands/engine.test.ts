import { describe, expect, test } from 'vitest';
import type { ParsedArgs } from '../parse.ts';
import { __test, type EngineDeps } from './engine.ts';
import type { EngineStatusReport } from './engine-render.ts';

const ANSI = /\[/;

function args(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return { flags: {}, values: {}, positionals: [], help: false, ...over };
}

const STATUS_FIXTURE: EngineStatusReport = {
    engineRoot: '/home/u/.tavern/engine',
    installedPins: ['c986377', 'abc1234'],
    marker: {
        binaryPath: '/home/u/.tavern/engine/c986377/hermes-agent/venv/bin/hermes',
        installedAt: '2026-06-01T10:00:00.000Z',
        installerSource: 'remote-download',
        ref: 'c9863772368720a892faaa6e1f3402dbea72f4bf',
    },
    pin: { kind: 'commit', ref: 'c9863772368720a892faaa6e1f3402dbea72f4bf', source: 'pinned' },
    resolved: {
        binary: {
            binaryPath: '/home/u/.tavern/engine/c986377/hermes-agent/venv/bin/hermes',
            tier: 'managed',
        },
        error: null,
    },
    systemAllowed: false,
};

function statusHarness(over: Partial<EngineDeps> = {}): {
    captured: string[];
    deps: Partial<EngineDeps>;
} {
    const captured: string[] = [];
    return {
        captured,
        deps: { status: () => STATUS_FIXTURE, write: (text) => captured.push(text), ...over },
    };
}

describe('engine status', () => {
    test('renders aligned key/value rows, exit 0, no ANSI', async () => {
        const { captured, deps } = statusHarness();
        const code = await __test.runStatus(args(), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('Pin');
        expect(text).toContain('Engine root');
        expect(text).toContain('Resolved');
        expect(text).toContain('(managed)');
        expect(ANSI.test(text)).toBe(false);
    });

    test('--json stays structurally identical', async () => {
        const { captured, deps } = statusHarness();
        await __test.runStatus(args({ flags: { '--json': true } }), deps);
        expect(captured.join('')).toBe(`${JSON.stringify(STATUS_FIXTURE, null, 2)}\n`);
    });
});

describe('engine clean', () => {
    function cleanHarness(installs: string[]) {
        const logged: string[] = [];
        const removed: string[] = [];
        return {
            logged,
            removed,
            deps: {
                listInstalls: () => installs,
                currentPinDir: () => 'c986377',
                removeInstall: (dir: string) => {
                    removed.push(dir);
                    return Promise.resolve();
                },
                log: (text: string) => logged.push(text),
            } satisfies Partial<EngineDeps>,
        };
    }

    test('keeps the current pin by default, removes the rest', async () => {
        const { logged, removed, deps } = cleanHarness(['c986377', 'abc1234']);
        const code = await __test.runClean(args(), deps);
        expect(code).toBe(0);
        expect(removed).toEqual(['abc1234']);
        expect(logged.join('\n')).toContain('Kept current pin: c986377');
    });

    test('--all removes every install', async () => {
        const { removed, deps } = cleanHarness(['c986377', 'abc1234']);
        await __test.runClean(args({ flags: { '--all': true } }), deps);
        expect(removed).toEqual(['c986377', 'abc1234']);
    });

    test('nothing to clean when only the current pin exists', async () => {
        const { logged, removed, deps } = cleanHarness(['c986377']);
        await __test.runClean(args(), deps);
        expect(removed).toEqual([]);
        expect(logged.join('\n')).toContain('Nothing to clean.');
    });
});

describe('engine install', () => {
    test('streams installer lines, then prints the ready line', async () => {
        const logged: string[] = [];
        const code = await __test.runInstall(args(), {
            log: (text) => logged.push(text),
            install: async (onLine) => {
                onLine('Downloading engine...');
                onLine('Building venv...');
                return { binaryPath: '/home/u/.tavern/engine/c986377/.../hermes', tier: 'managed' };
            },
        });
        expect(code).toBe(0);
        expect(logged).toContain('Downloading engine...');
        expect(logged).toContain('Building venv...');
        expect(logged.at(-1)).toContain('Agent engine ready:');
    });
});
