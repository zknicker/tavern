import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cleanupStaleDesktopDevServer,
    getDesktopDevEnvironment,
    parseDesktopDevArguments,
} from './run-desktop-dev.mjs';

test('parses a positional base port and forwards remaining electron args', () => {
    const options = parseDesktopDevArguments(['4242', '--no-watch']);

    assert.deepEqual(options, {
        pid: undefined,
        port: '4242',
        serverPort: undefined,
        skipServerCleanup: false,
        electronArguments: ['--no-watch'],
        websitePort: undefined,
    });
});

test('parses named port options and preserves other electron args', () => {
    const options = parseDesktopDevArguments([
        '--port',
        '4242',
        '--backend-port',
        '4243',
        '--verbose',
    ]);

    assert.deepEqual(options, {
        pid: undefined,
        port: '4242',
        serverPort: '4243',
        skipServerCleanup: false,
        electronArguments: ['--verbose'],
        websitePort: undefined,
    });
});

test('parses an optional PID separately from port settings', () => {
    const options = parseDesktopDevArguments(['--pid', '31337', '--vite-port', '4242']);

    assert.deepEqual(options, {
        pid: '31337',
        port: undefined,
        serverPort: undefined,
        skipServerCleanup: false,
        electronArguments: [],
        websitePort: '4242',
    });
});

test('exports the resolved dev ports into the desktop dev environment', () => {
    const environment = getDesktopDevEnvironment({
        baseEnvironment: { PATH: '/usr/bin' },
        port: '4242',
    });

    assert.equal(environment.TAVERN_SERVER_PORT, '4243');
    assert.equal(environment.TAVERN_WEBSITE_PORT, '4242');
    assert.equal(environment.PATH, '/usr/bin');
});

test('exports the PID when it is provided explicitly', () => {
    const environment = getDesktopDevEnvironment({
        baseEnvironment: { PATH: '/usr/bin' },
        pid: '31337',
    });

    assert.equal(environment.TAVERN_DESKTOP_DEV_PID, '31337');
});

test('rejects invalid PID values', () => {
    assert.throws(() => {
        parseDesktopDevArguments(['--pid', 'abc']);
    }, /Expected a positive integer PID/);
});

test('rejects invalid port values', () => {
    assert.throws(() => {
        parseDesktopDevArguments(['abc']);
    }, /Expected a valid port/);
});

test('cleanupStaleDesktopDevServer kills a stale Bun watcher in the current workspace', () => {
    const killedProcessIds = [];
    let listenChecks = 0;

    const result = cleanupStaleDesktopDevServer({
        killImpl: (pid) => {
            killedProcessIds.push(pid);
        },
        repositoryRoot: '/repo',
        serverPort: '4243',
        spawnSyncImpl: (command, args) => {
            const key = [command, ...args].join(' ');

            if (key === 'lsof -nP -t -iTCP:4243 -sTCP:LISTEN') {
                listenChecks += 1;
                return {
                    stdout: listenChecks >= 2 ? '' : '111\n222\n',
                };
            }

            if (key === 'lsof -a -p 111 -d cwd -Fn') {
                return {
                    stdout: 'p111\nfcwd\nn/repo/apps/server\n',
                };
            }

            if (key === 'ps -p 111 -o command=') {
                return {
                    stdout: 'bun --watch src/index.ts\n',
                };
            }

            if (key === 'lsof -a -p 222 -d cwd -Fn') {
                return {
                    stdout: 'p222\nfcwd\nn/repo/apps/server\n',
                };
            }

            if (key === 'ps -p 222 -o command=') {
                return {
                    stdout: 'node something-else.js\n',
                };
            }

            return {
                stdout: '',
            };
        },
    });

    assert.deepEqual(result, [111]);
    assert.deepEqual(killedProcessIds, [111]);
});

test('cleanupStaleDesktopDevServer ignores Bun watchers from other workspaces', () => {
    const killedProcessIds = [];
    const commandOutputs = new Map([
        ['lsof -nP -t -iTCP:4243 -sTCP:LISTEN', '111\n'],
        ['lsof -a -p 111 -d cwd -Fn', 'p111\nfcwd\nn/other/apps/server\n'],
        ['ps -p 111 -o command=', 'bun --watch src/index.ts\n'],
    ]);

    const result = cleanupStaleDesktopDevServer({
        killImpl: (pid) => {
            killedProcessIds.push(pid);
        },
        repositoryRoot: '/repo',
        serverPort: '4243',
        spawnSyncImpl: (command, args) => ({
            stdout: commandOutputs.get([command, ...args].join(' ')) ?? '',
        }),
    });

    assert.deepEqual(result, []);
    assert.deepEqual(killedProcessIds, []);
});

test('cleanupStaleDesktopDevServer escalates when the stale watcher keeps the port open', () => {
    const killedSignals = [];
    let listenChecks = 0;

    const result = cleanupStaleDesktopDevServer({
        killImpl: (pid, signal) => {
            killedSignals.push([pid, signal]);
        },
        repositoryRoot: '/repo',
        serverPort: '4243',
        spawnSyncImpl: (command, args) => {
            const key = [command, ...args].join(' ');

            if (key === 'lsof -nP -t -iTCP:4243 -sTCP:LISTEN') {
                listenChecks += 1;
                return {
                    stdout: listenChecks >= 3 ? '' : '111\n',
                };
            }

            if (key === 'lsof -a -p 111 -d cwd -Fn') {
                return {
                    stdout: 'p111\nfcwd\nn/repo/apps/server\n',
                };
            }

            if (key === 'ps -p 111 -o command=') {
                return {
                    stdout: 'bun --watch src/index.ts\n',
                };
            }

            return {
                stdout: '',
            };
        },
    });

    assert.deepEqual(result, [111]);
    assert.deepEqual(killedSignals, [
        [111, 'SIGTERM'],
        [111, 'SIGKILL'],
    ]);
});
