import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatHeader,
    formatLogLine,
    formatReadyBlock,
    formatStatusLine,
    getSnapshotChangeLines,
} from './dev-stack-log-format.mjs';

function snapshot(overrides = {}) {
    return {
        config: {
            databasePath: '~/.tavern/tavern.sqlite',
            desktopEnabled: true,
            runtimeRoot: '~/.tavern',
            runtimeUrl: 'http://127.0.0.1:18790',
            serverUrl: 'http://localhost:8080',
            websiteUrl: 'http://localhost:3100',
        },
        jobs: { items: [], state: 'idle' },
        phase: 'starting',
        processes: {
            desktop: { status: 'waiting' },
            runtime: { status: 'waiting' },
            server: { status: 'waiting' },
            website: { status: 'waiting' },
        },
        staleCleanupCount: 0,
        ...overrides,
    };
}

test('formatHeader prints durable startup context once', () => {
    const output = formatHeader(snapshot(), { colorize: false });

    assert.match(output, /🎰 tavern booting local stack/u);
    assert.doesNotMatch(output, /server http:\/\/localhost:8080/u);
    assert.doesNotMatch(output, /data ~\/\.tavern\/tavern\.sqlite/u);
});

test('formatLogLine prefixes process output without clipping errors', () => {
    const output = formatLogLine(
        {
            line: '[15:03:13.147] ERROR Container runtime unavailable detail="docker info failed" fix="Start Docker Desktop or Colima"',
            source: 'runtime',
        },
        { colorize: false }
    );

    assert.equal(
        output,
        '🧠 runtime [15:03:13.147] ERROR Container runtime unavailable detail="docker info failed" fix="Start Docker Desktop or Colima"'
    );
});

test('formatStatusLine shows concise process transitions', () => {
    assert.equal(
        formatStatusLine('desktop', 'starting', 'enabled', { colorize: false }),
        '◐ desktop starting enabled'
    );
    assert.equal(
        formatStatusLine('runtime', 'running', 'http://127.0.0.1:18790', { colorize: false }),
        '✓ runtime ready http://127.0.0.1:18790'
    );
    assert.equal(
        formatStatusLine('runtime', 'stopping', 'http://127.0.0.1:18790', { colorize: false }),
        '◐ runtime stopping http://127.0.0.1:18790'
    );
});

test('formatReadyBlock prints the final startup summary', () => {
    const currentSnapshot = snapshot({
        jobs: {
            items: [
                {
                    cadence: '5m',
                    immediate: true,
                    key: 'sync-codex-usage',
                    label: 'Sync Codex Usage',
                    state: 'enabled',
                },
            ],
            state: 'ready',
        },
        phase: 'running',
        processes: {
            desktop: { status: 'running' },
            runtime: { status: 'running' },
            server: { status: 'running' },
            website: { status: 'running' },
        },
    });

    const output = formatReadyBlock(currentSnapshot, { colorize: false });

    assert.match(output, /╭─ 🎰 TAVERN/u);
    assert.match(output, /Ready to go/u);
    assert.match(output, /Runtime\s+http:\/\/127\.0\.0\.1:18790/u);
    assert.match(output, /Server\s+http:\/\/localhost:8080/u);
    assert.match(output, /Website\s+http:\/\/localhost:3100/u);
    assert.match(output, /Desktop\s+running/u);
    assert.match(output, /Sync Codex Usage every 5m · immediate/u);
    assert.match(output, /DB\s+~\/\.tavern\/tavern\.sqlite/u);
});

test('getSnapshotChangeLines keeps ready details in the final block', () => {
    const currentSnapshot = snapshot({
        jobs: {
            items: [
                {
                    cadence: '5m',
                    immediate: true,
                    key: 'sync-codex-usage',
                    label: 'Sync Codex Usage',
                    state: 'enabled',
                },
            ],
            state: 'ready',
        },
        phase: 'running',
        processes: {
            desktop: { status: 'running' },
            runtime: { status: 'running' },
            server: { status: 'running' },
            website: { status: 'running' },
        },
    });
    const previous = {
        jobs: {},
        jobsState: 'loading',
        phase: 'starting',
        processes: {
            desktop: 'starting',
            runtime: 'running',
            server: 'running',
            website: 'running',
        },
        staleCleanupCount: 0,
    };
    const next = {
        jobs: {
            'sync-codex-usage': 'enabled:5m:true:Sync Codex Usage',
        },
        jobsState: 'ready',
        phase: 'running',
        processes: {
            desktop: 'running',
            runtime: 'running',
            server: 'running',
            website: 'running',
        },
        staleCleanupCount: 0,
    };

    const lines = getSnapshotChangeLines(previous, next, currentSnapshot, { colorize: false });

    assert.equal(lines.length, 1);
    assert.match(lines[0], /╭─ 🎰 TAVERN/u);
    assert.match(lines[0], /Sync Codex Usage every 5m · immediate/u);
    assert.doesNotMatch(lines[0], /scheduled jobs ready/u);
});

test('getSnapshotChangeLines still streams startup progress', () => {
    const previous = {
        jobs: {},
        jobsState: 'idle',
        phase: 'starting',
        processes: {
            desktop: 'waiting',
            runtime: 'waiting',
            server: 'waiting',
            website: 'waiting',
        },
        staleCleanupCount: 0,
    };
    const next = {
        ...previous,
        processes: {
            ...previous.processes,
            runtime: 'starting',
        },
    };

    assert.deepEqual(getSnapshotChangeLines(previous, next, snapshot(), { colorize: false }), [
        '◐ runtime starting',
    ]);
});
