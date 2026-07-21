import { describe, expect, test } from 'vitest';
import type { ParsedArgs } from '../parse.ts';
import { __test, type EngineDeps } from './engine.ts';
import type { EngineStatusReport } from './engine-render.ts';

const ANSI = /\[/;

function args(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return { flags: {}, values: {}, positionals: [], help: false, ...over };
}

const STATUS_FIXTURE: EngineStatusReport = {
    agentHome: '/home/u/.grotto/runtime/agent',
    installedPins: [],
    mode: 'local-ai-sdk',
    provider: 'openai',
    resolved: {
        detail: 'Agent and AI SDK package dependencies',
        tier: 'package',
    },
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
    test('renders local agent engine rows, exit 0, no ANSI', async () => {
        const { captured, deps } = statusHarness();
        const code = await __test.runStatus(args(), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('Mode');
        expect(text).toContain('local-ai-sdk');
        expect(text).toContain('Provider');
        expect(ANSI.test(text)).toBe(false);
    });

    test('--json stays structurally identical', async () => {
        const { captured, deps } = statusHarness();
        await __test.runStatus(args({ flags: { '--json': true } }), deps);
        expect(captured.join('')).toBe(`${JSON.stringify(STATUS_FIXTURE, null, 2)}\n`);
    });
});

describe('engine clean', () => {
    test('removes local artifacts reported by the dependency', async () => {
        const logged: string[] = [];
        const removed: string[] = [];
        const code = await __test.runClean(args(), {
            listInstalls: () => ['agent-cache'],
            removeInstall: (dir: string) => {
                removed.push(dir);
                return Promise.resolve();
            },
            log: (text) => logged.push(text),
        });
        expect(code).toBe(0);
        expect(removed).toEqual(['agent-cache']);
        expect(logged.join('\n')).toContain('Removed engine artifacts: agent-cache');
    });
});

describe('engine install', () => {
    test('prepares the local package engine', async () => {
        const logged: string[] = [];
        const code = await __test.runInstall(args(), {
            log: (text) => logged.push(text),
            install: async () => ({ detail: 'Agent home ready', tier: 'package' }),
        });
        expect(code).toBe(0);
        expect(logged.at(-1)).toContain('Agent engine ready: Agent home ready');
    });
});
