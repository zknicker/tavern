import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { signalChildProcessGroup, waitForChildShutdown } from './dev-stack-controller.mjs';

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
