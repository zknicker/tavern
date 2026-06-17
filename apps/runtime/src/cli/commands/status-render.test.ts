import { describe, expect, test } from 'vitest';
import type { RuntimeCapability } from '../runtime-probe';
import { capabilityTone, relativeTime, renderStatus, type StatusReport } from './status-render';

const NOW = Date.parse('2026-06-10T12:00:00.000Z');
const STREAM = { isTTY: false } as unknown as NodeJS.WriteStream;

function capability(over: Partial<RuntimeCapability>): RuntimeCapability {
    return {
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
        ...over,
    };
}

function baseReport(over: Partial<StatusReport> = {}): StatusReport {
    return {
        binary: { version: '1.4.2' },
        service: { state: 'running', via: 'homebrew' },
        runtime: {
            url: 'http://127.0.0.1:18790',
            reachable: true,
            version: '1.4.2',
            health: 'healthy',
        },
        runtimeIsLocal: true,
        capabilities: [capability({})],
        engine: {
            pin: {
                kind: 'commit',
                ref: 'c9863772368720a892faaa6e1f3402dbea72f4bf',
                source: 'pinned',
            },
            resolved: {
                path: '~/.tavern/engine/c986377/hermes-agent/venv/bin/hermes',
                tier: 'managed',
            },
        },
        ...over,
    };
}

function render(report: StatusReport): string {
    return renderStatus(report, { now: NOW, stream: STREAM });
}

describe('relativeTime', () => {
    test('null → unknown', () => {
        expect(relativeTime(null, NOW)).toBe('unknown');
    });
    test('unparseable → unknown', () => {
        expect(relativeTime('not-a-date', NOW)).toBe('unknown');
    });
    test('under 45s → just now', () => {
        expect(relativeTime('2026-06-10T11:59:30.000Z', NOW)).toBe('just now');
    });
    test('minutes', () => {
        expect(relativeTime('2026-06-10T11:54:00.000Z', NOW)).toBe('6m ago');
    });
    test('hours', () => {
        expect(relativeTime('2026-06-10T10:00:00.000Z', NOW)).toBe('2h ago');
    });
    test('days', () => {
        expect(relativeTime('2026-06-07T12:00:00.000Z', NOW)).toBe('3d ago');
    });
});

describe('capabilityTone', () => {
    test('healthy → healthy', () => {
        expect(capabilityTone('healthy')).toBe('healthy');
    });
    test('degraded and unknown → degraded', () => {
        expect(capabilityTone('degraded')).toBe('degraded');
        expect(capabilityTone('unknown')).toBe('degraded');
    });
    test('unavailable and unauthorized → off', () => {
        expect(capabilityTone('unavailable')).toBe('off');
        expect(capabilityTone('unauthorized')).toBe('off');
    });
});

describe('renderStatus', () => {
    test('full healthy screen', () => {
        const text = render(baseReport());
        expect(text).toContain('Tavern Runtime v1.4.2');
        expect(text).toContain('Service  running (homebrew)');
        expect(text).toContain('Runtime  v1.4.2 · healthy · http://127.0.0.1:18790');
        expect(text).toContain('Binary   v1.4.2 · up to date');
        expect(text).toContain('● Codex OAuth');
        expect(text).toContain('6m ago');
        expect(text).toContain('Pin       c986377 (commit, pinned)');
        expect(text).toContain('(managed)');
    });

    test('stale process: running < binary surfaces staged hint', () => {
        const report = baseReport({
            runtime: {
                url: 'http://127.0.0.1:18790',
                reachable: true,
                version: '1.4.0',
                health: 'healthy',
            },
        });
        const text = render(report);
        expect(text).toContain("binary v1.4.2 staged, run 'tavern restart'");
        expect(text).toContain('Binary   v1.4.2 · staged — runtime still on v1.4.0');
    });

    test('runtime down: service/binary/engine still render; capabilities dim line', () => {
        const report = baseReport({
            runtime: {
                url: 'http://127.0.0.1:18790',
                reachable: false,
                version: null,
                health: null,
            },
            capabilities: null,
        });
        const text = render(report);
        expect(text).toContain("Runtime  not running · 'brew services start tavern-runtime'");
        expect(text).toContain('Binary   v1.4.2 · installed');
        expect(text).toContain('Runtime not reachable — capabilities unavailable.');
        expect(text).toContain('Service  running (homebrew)');
        expect(text).toContain('Engine');
    });

    test('capability degraded and unavailable render dots + reasons as-is', () => {
        const report = baseReport({
            capabilities: [
                capability({
                    displayName: 'Vault',
                    state: 'degraded',
                    healthy: false,
                    reason: 'Managed Vault skill has not been prepared.',
                    updatedAt: '2026-06-10T11:59:50.000Z',
                }),
                capability({
                    displayName: 'Agent engine API',
                    state: 'unavailable',
                    healthy: false,
                    reason: 'Managed agent engine API is not reachable.',
                }),
            ],
        });
        const text = render(report);
        expect(text).toContain('◐ Vault');
        expect(text).toContain('just now — Managed Vault skill has not been prepared.');
        expect(text).toContain('○ Agent engine API');
        expect(text).toContain('— Managed agent engine API is not reachable.');
    });

    test('brew missing: service line degrades, other sections intact', () => {
        const report = baseReport({ service: null });
        const text = render(report);
        expect(text).toContain('Service  unknown — Homebrew not available');
        expect(text).toContain('Runtime  v1.4.2 · healthy');
    });

    test('remote runtime URL skips the staged-binary hint', () => {
        const report = baseReport({
            runtimeIsLocal: false,
            runtime: {
                url: 'https://remote.example:18790',
                reachable: true,
                version: '1.4.0',
                health: 'healthy',
            },
        });
        const text = render(report);
        expect(text).toContain('v1.4.0 · healthy · https://remote.example:18790');
        expect(text).not.toContain('staged, run');
        expect(text).toContain('· installed');
        // Local-only sections gain a (local) label when the runtime is remote.
        expect(text).toContain('Service (local)');
        expect(text).toContain('Binary (local)');
    });
});
