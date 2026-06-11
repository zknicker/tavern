import { describe, expect, test } from 'vitest';
import type { Brew, BrewResult } from '../brew';
import type { ParsedArgs } from '../parse';
import type { RuntimeSnapshot } from '../runtime-probe';
import { runStatusCommand, type StatusDeps } from './status';
import type { StatusEngineSection } from './status-render';

const NOW = Date.parse('2026-06-10T12:00:00.000Z');
const LOCAL_URL = 'http://127.0.0.1:18790';

function brewResult(over: Partial<BrewResult>): BrewResult {
    return { code: 0, missing: false, stdout: '', stderr: '', ...over };
}

function fakeBrew(over: Partial<Brew> = {}): Brew {
    const stub = (): BrewResult => brewResult({});
    return {
        isAvailable: () => true,
        isRuntimeOutdated: () => false,
        servicesInfoRuntimeJson: () =>
            brewResult({ stdout: JSON.stringify([{ running: true, status: 'started' }]) }),
        servicesRestartRuntime: stub,
        update: stub,
        upgradeRuntime: stub,
        ...over,
    };
}

function snapshot(over: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
    return {
        capabilities: [
            {
                checkedAt: null,
                displayName: 'Codex OAuth',
                healthy: true,
                id: 'codexOAuth',
                lastHealthyAt: null,
                metadata: {},
                nextCheckAt: null,
                reason: null,
                state: 'healthy',
                technicalMessage: null,
                updatedAt: '2026-06-10T11:54:00.000Z',
            },
        ],
        health: 'healthy',
        reachable: true,
        version: '1.4.2',
        ...over,
    };
}

const engineSection: StatusEngineSection = {
    pin: { kind: 'commit', ref: 'c9863772368720a892faaa6e1f3402dbea72f4bf', source: 'pinned' },
    resolved: {
        path: '/home/u/.tavern/engine/c986377/hermes-agent/venv/bin/hermes',
        tier: 'managed',
    },
};

function deps(over: Partial<StatusDeps> = {}): { captured: string[]; deps: Partial<StatusDeps> } {
    const captured: string[] = [];
    return {
        captured,
        deps: {
            brew: fakeBrew(),
            binaryVersion: '1.4.2',
            engineSection: () => engineSection,
            localUrl: LOCAL_URL,
            now: () => NOW,
            probe: () => Promise.resolve(snapshot()),
            write: (text) => captured.push(text),
            ...over,
        },
    };
}

function args(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return { flags: {}, values: {}, positionals: [], help: false, ...over };
}

const ANSI = /\[/;

describe('runStatusCommand', () => {
    test('full healthy renders all sections, exit 0', async () => {
        const { captured, deps: d } = deps();
        const code = await runStatusCommand(args(), d);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('Tavern Runtime v1.4.2');
        expect(text).toContain('Service  running (homebrew)');
        expect(text).toContain('Runtime  v1.4.2 · healthy · http://127.0.0.1:18790');
        expect(text).toContain('Binary   v1.4.2 · up to date');
        expect(text).toContain('Codex OAuth');
        expect(text).toContain('Engine');
        expect(ANSI.test(text)).toBe(false);
    });

    test('stale process: running older than binary, exit 0 with staged hint', async () => {
        const { captured, deps: d } = deps({
            probe: () => Promise.resolve(snapshot({ version: '1.4.0' })),
        });
        const code = await runStatusCommand(args(), d);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain("binary v1.4.2 staged, run 'tavern restart'");
    });

    test('runtime down: service/binary/engine render, capabilities dim line, exit 0', async () => {
        const { captured, deps: d } = deps({
            probe: () =>
                Promise.resolve(
                    snapshot({ reachable: false, version: null, health: null, capabilities: null })
                ),
        });
        const code = await runStatusCommand(args(), d);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain("Runtime  not running · 'brew services start tavern-runtime'");
        expect(text).toContain('Runtime not reachable — capabilities unavailable.');
        expect(text).toContain('Service  running (homebrew)');
        expect(text).toContain('Engine');
    });

    test('brew missing: service degrades, runtime/capabilities still render, exit 0', async () => {
        const { captured, deps: d } = deps({
            brew: fakeBrew({
                servicesInfoRuntimeJson: () => brewResult({ missing: true, code: null }),
            }),
        });
        const code = await runStatusCommand(args(), d);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('Service  unknown — Homebrew not available');
        expect(text).toContain('Codex OAuth');
    });

    test('capability degraded renders ◐ and reason as-is', async () => {
        const { captured, deps: d } = deps({
            probe: () =>
                Promise.resolve(
                    snapshot({
                        capabilities: [
                            {
                                checkedAt: null,
                                displayName: 'Cortex wiki',
                                healthy: false,
                                id: 'cortexWiki',
                                lastHealthyAt: null,
                                metadata: {},
                                nextCheckAt: null,
                                reason: 'Managed wiki skill has not been prepared.',
                                state: 'degraded',
                                technicalMessage: null,
                                updatedAt: '2026-06-10T11:59:55.000Z',
                            },
                        ],
                    })
                ),
        });
        await runStatusCommand(args(), d);
        const text = captured.join('');
        expect(text).toContain('◐ Cortex wiki');
        expect(text).toContain('just now — Managed wiki skill has not been prepared.');
    });

    test('--json emits one parseable document with all keys and no ANSI', async () => {
        const { captured, deps: d } = deps();
        const code = await runStatusCommand(args({ flags: { '--json': true } }), d);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(ANSI.test(text)).toBe(false);
        const doc = JSON.parse(text);
        expect(Object.keys(doc).sort()).toEqual([
            'binary',
            'capabilities',
            'engine',
            'runtime',
            'runtimeIsLocal',
            'service',
        ]);
        expect(doc.binary.version).toBe('1.4.2');
        expect(doc.service).toEqual({ state: 'running', via: 'homebrew' });
        expect(doc.runtime.version).toBe('1.4.2');
        expect(doc.capabilities).toHaveLength(1);
        expect(doc.engine.pin.source).toBe('pinned');
    });

    test('--json nulls unavailable sections rather than omitting keys', async () => {
        const { captured, deps: d } = deps({
            brew: fakeBrew({
                servicesInfoRuntimeJson: () => brewResult({ missing: true, code: null }),
            }),
            probe: () =>
                Promise.resolve(
                    snapshot({ reachable: false, version: null, health: null, capabilities: null })
                ),
        });
        await runStatusCommand(args({ flags: { '--json': true } }), d);
        const doc = JSON.parse(captured.join(''));
        expect(doc.service).toBeNull();
        expect(doc.capabilities).toBeNull();
        expect(doc.runtime.reachable).toBe(false);
        expect(doc).toHaveProperty('engine');
    });

    test('--runtime-url targets a remote runtime and skips local-only binary hint', async () => {
        const { captured, deps: d } = deps({
            probe: () => Promise.resolve(snapshot({ version: '1.4.0' })),
        });
        await runStatusCommand(args({ values: { '--runtime-url': 'https://remote:18790' } }), d);
        const text = captured.join('');
        expect(text).toContain('https://remote:18790');
        expect(text).not.toContain('staged, run');
    });
});
