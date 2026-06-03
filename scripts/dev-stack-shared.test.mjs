import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    cleanupStaleProcesses,
    createDevStackEnvironment,
    formatPortBlockers,
    waitForRuntimeReady,
} from './dev-stack-shared.mjs';

test('formatPortBlockers includes owner process details', () => {
    const repositoryRoot = path.join('/Users', 'zknicker', 'repo');
    const message = formatPortBlockers(
        [
            {
                command: 'bun --watch src/index.ts',
                cwd: path.join('/Users', 'zknicker', 'repo', 'apps', 'runtime'),
                label: 'runtime',
                pid: 1234,
                port: 18_790,
            },
        ],
        repositoryRoot
    );

    assert.match(message, /Required dev port unavailable/u);
    assert.match(message, /runtime port 18790 is already in use by PID 1234/u);
    assert.match(message, /bun --watch src\/index\.ts/u);
    assert.match(message, /\.\/apps\/runtime/u);
});

test('waitForRuntimeReady reads the Runtime capabilities health envelope', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];

    globalThis.fetch = async (url) => {
        requestedUrls.push(String(url));
        return Response.json({
            health: {
                ok: true,
                status: 'healthy',
                timestamp: '2026-05-28T00:00:00.000Z',
            },
        });
    };

    try {
        await waitForRuntimeReady(500);
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.deepEqual(requestedUrls, ['http://127.0.0.1:18790/capabilities']);
});

test('createDevStackEnvironment uses shared dev state outside packaged app state', () => {
    const environment = createDevStackEnvironment({
        baseEnvironment: { PATH: '/usr/bin' },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.PATH, '/usr/bin');
    assert.equal(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'tavern.sqlite')
    );
    assert.equal(
        environment.TAVERN_RUNTIME_ROOT,
        path.join(os.homedir(), '.tavern', 'dev', 'runtime')
    );
    assert.notEqual(environment.DATABASE_PATH, path.join(os.homedir(), '.tavern', 'tavern.sqlite'));
    assert.notEqual(environment.TAVERN_RUNTIME_ROOT, path.join(os.homedir(), '.tavern', 'runtime'));
});

test('createDevStackEnvironment preserves explicit state overrides', () => {
    const environment = createDevStackEnvironment({
        baseEnvironment: {
            DATABASE_PATH: '/tmp/tavern.sqlite',
            TAVERN_RUNTIME_ROOT: '/tmp/tavern-runtime',
        },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.DATABASE_PATH, '/tmp/tavern.sqlite');
    assert.equal(environment.TAVERN_RUNTIME_ROOT, '/tmp/tavern-runtime');
});

test('cleanupStaleProcesses closes the old Tauri desktop app in desktop mode', () => {
    const killedProcesses = [];
    const cleanupCount = cleanupStaleProcesses({
        mode: 'desktop-runtime',
        ports: {
            serverPort: 8080,
            websitePort: 3100,
        },
        processTools: {
            killProcess: (pid, signal) => {
                killedProcesses.push([pid, signal]);
            },
            listListeningProcessIds: (port) => (port === 3180 ? [222] : []),
            readProcessCommand: (pid) =>
                pid === 222
                    ? '/Applications/Tavern.app/Contents/MacOS/tavern-server --app-origin tauri://localhost --server-port 3180'
                    : '',
            readProcessParentId: (pid) => (pid === 222 ? 111 : null),
            readProcessWorkingDirectory: () => null,
            stopGlobalOpenClawLaunchAgent: () => undefined,
            waitForProcessExit: () => undefined,
        },
        repositoryRoot: '/repo',
    });

    assert.equal(cleanupCount, 2);
    assert.deepEqual(killedProcesses, [
        [222, 'SIGTERM'],
        [111, 'SIGTERM'],
    ]);
});
