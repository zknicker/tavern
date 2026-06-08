import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveDevPorts } from './dev-ports.mjs';
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
        await waitForRuntimeReady(undefined, 500);
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.deepEqual(requestedUrls, ['http://127.0.0.1:18790/capabilities']);
});

test('createDevStackEnvironment uses shared dev state outside packaged app state', () => {
    const ports = resolveDevPorts({
        baseEnvironment: {
            TAVERN_DEV_PORT_BASE: '42000',
            TAVERN_DEV_STACK_ID: 'alpha',
        },
        repositoryRoot: '/repo/tavern',
    });
    const environment = createDevStackEnvironment({
        baseEnvironment: {
            PATH: '/usr/bin',
            TAVERN_DEV_PORT_BASE: '42000',
            TAVERN_DEV_STACK_ID: 'alpha',
        },
        ports,
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.PATH, '/usr/bin');
    assert.equal(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern-hermes', 'dev', 'alpha', 'tavern.sqlite')
    );
    assert.equal(
        environment.TAVERN_RUNTIME_ROOT,
        path.join(os.homedir(), '.tavern-hermes', 'dev', 'alpha', 'runtime')
    );
    assert.equal(environment.TAVERN_HERMES_PORT, '42003');
    assert.equal(environment.TAVERN_RUNTIME_PORT, '42002');
    assert.equal(environment.TAVERN_SERVER_PORT, '42001');
    assert.equal(environment.TAVERN_WEBSITE_PORT, '42000');
    assert.notEqual(environment.DATABASE_PATH, path.join(os.homedir(), '.tavern', 'tavern.sqlite'));
    assert.notEqual(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'tavern.sqlite')
    );
    assert.notEqual(environment.TAVERN_RUNTIME_ROOT, path.join(os.homedir(), '.tavern', 'runtime'));
});

test('resolveDevPorts derives different default port groups for different worktrees', () => {
    const left = resolveDevPorts({ repositoryRoot: '/repo/worktree-left/tavern' });
    const right = resolveDevPorts({ repositoryRoot: '/repo/worktree-right/tavern' });

    assert.notDeepEqual(left, right);
    assert.equal(Number(left.serverPort), Number(left.websitePort) + 1);
    assert.equal(Number(left.runtimePort), Number(left.websitePort) + 2);
    assert.equal(Number(left.hermesPort), Number(left.websitePort) + 3);
});

test('createDevStackEnvironment preserves explicit state overrides', () => {
    const environment = createDevStackEnvironment({
        baseEnvironment: {
            DATABASE_PATH: '/tmp/tavern.sqlite',
            TAVERN_HERMES_PORT: '39119',
            TAVERN_RUNTIME_PORT: '39190',
            TAVERN_RUNTIME_ROOT: '/tmp/tavern-runtime',
        },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.DATABASE_PATH, '/tmp/tavern.sqlite');
    assert.equal(environment.TAVERN_HERMES_PORT, '39119');
    assert.equal(environment.TAVERN_RUNTIME_PORT, '39190');
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

test('cleanupStaleProcesses closes managed Hermes owned by this worktree', () => {
    const killedProcesses = [];
    const cleanupCount = cleanupStaleProcesses({
        mode: 'desktop-runtime',
        ports: {
            hermesPort: 42_003,
            runtimePort: 42_002,
            serverPort: 42_001,
            websitePort: 42_000,
        },
        processTools: {
            killProcess: (pid, signal) => {
                killedProcesses.push([pid, signal]);
            },
            listListeningProcessIds: (port) => (port === 42_003 ? [333] : []),
            readProcessCommand: (pid) =>
                pid === 333 ? '/Users/z/.local/bin/hermes dashboard --port 42003' : '',
            readProcessParentId: () => null,
            readProcessWorkingDirectory: (pid) => (pid === 333 ? '/repo/apps/runtime' : null),
            waitForProcessExit: () => undefined,
        },
        repositoryRoot: '/repo',
    });

    assert.equal(cleanupCount, 1);
    assert.deepEqual(killedProcesses, [[333, 'SIGTERM']]);
});
