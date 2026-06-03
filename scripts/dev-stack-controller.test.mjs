import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
    DevStackController,
    signalChildProcessGroup,
    waitForChildShutdown,
} from './dev-stack-controller.mjs';

test('dev stack shutdown signals all managed processes before waiting in order', async () => {
    const controller = new DevStackController({
        mode: 'desktop-runtime',
        ports: { serverPort: 80_800, websitePort: 31_000 },
        repositoryRoot: process.cwd(),
    });
    const desktop = createManagedChildProcessStub(12_341, { autoExit: false });
    const website = createManagedChildProcessStub(12_342);
    const server = createManagedChildProcessStub(12_343);
    const runtime = createManagedChildProcessStub(12_344);

    controller.processes.set('desktop', desktop);
    controller.processes.set('website', website);
    controller.processes.set('server', server);
    controller.processes.set('runtime', runtime);

    const stopPromise = controller.stop(0);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(desktop.signals, ['SIGTERM']);
    assert.deepEqual(website.signals, ['SIGTERM']);
    assert.deepEqual(server.signals, ['SIGTERM']);
    assert.deepEqual(runtime.signals, ['SIGTERM']);

    desktop.exitCode = 0;
    desktop.emit('exit', 0, null);
    await stopPromise;
});

test('waitForChildShutdown waits after the shell exits until the process group is gone', async () => {
    const child = createChildProcessStub();
    let groupActive = true;
    const startedAt = Date.now();

    const stopped = await waitForChildShutdown(
        child,
        () => {
            child.exitCode = 0;
            child.emit('exit', 0, null);
            setTimeout(() => {
                groupActive = false;
            }, 20);
        },
        {
            isProcessGroupActive: () => groupActive,
            pollMs: 1,
            timeoutMs: 250,
        }
    );

    assert.equal(stopped, true);
    assert.ok(Date.now() - startedAt >= 15);
});

test('waitForChildShutdown times out when the process group survives the shell', async () => {
    const child = createChildProcessStub();

    const stopped = await waitForChildShutdown(
        child,
        () => {
            child.exitCode = 0;
            child.emit('exit', 0, null);
        },
        {
            isProcessGroupActive: () => true,
            pollMs: 1,
            timeoutMs: 10,
        }
    );

    assert.equal(stopped, false);
});

test('signalChildProcessGroup can signal surviving groups after the shell exits', () => {
    const child = createChildProcessStub();
    const signals = [];

    child.exitCode = 0;

    const signaled = signalChildProcessGroup(child, 'SIGKILL', (pid, signal) => {
        signals.push({ pid, signal });
    });

    assert.equal(signaled, true);
    assert.deepEqual(signals, [{ pid: -12_345, signal: 'SIGKILL' }]);
});

function createChildProcessStub() {
    const child = new EventEmitter();
    child.exitCode = null;
    child.kill = () => {
        throw new Error('child.kill should not be called');
    };
    child.off = child.removeListener.bind(child);
    child.pid = 12_345;
    child.signalCode = null;
    return child;
}

function createManagedChildProcessStub(pid, options = {}) {
    const child = new EventEmitter();
    child.exitCode = null;
    child.kill = (signal) => {
        child.signals.push(signal);
        if (options.autoExit !== false) {
            child.signalCode = signal;
            child.emit('exit', null, signal);
        }
        return true;
    };
    child.off = child.removeListener.bind(child);
    child.pid = pid;
    child.signalCode = null;
    child.signals = [];
    return child;
}
