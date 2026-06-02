import assert from 'node:assert/strict';
import test from 'node:test';
import { isOrphanedProcess, startOrphanExitWatch } from '../src/dev/orphan-exit-watch.ts';

test('isOrphanedProcess detects launchd-reparented processes', () => {
    assert.equal(isOrphanedProcess(1), true);
    assert.equal(isOrphanedProcess(42), false);
});

test('startOrphanExitWatch exits once the dev parent disappears', () => {
    let activeParentPid = 4242;
    let scheduledCallback: (() => void) | null = null;
    let exitedWithCode: number | undefined;
    let unrefCalled = false;

    const stopWatching = startOrphanExitWatch({
        clearInterval: () => undefined,
        enabled: true,
        exit: (code) => {
            exitedWithCode = code;
        },
        getParentPid: () => activeParentPid,
        logger: {
            log: () => undefined,
        },
        setInterval: (callback) => {
            scheduledCallback = callback;

            return {
                ref() {
                    return this;
                },
                refresh() {
                    return this;
                },
                unref() {
                    unrefCalled = true;
                    return this;
                },
            } as ReturnType<typeof globalThis.setInterval>;
        },
    });

    assert.equal(typeof scheduledCallback, 'function');
    assert.equal(unrefCalled, true);
    assert.equal(exitedWithCode, undefined);

    scheduledCallback?.();
    assert.equal(exitedWithCode, undefined);

    activeParentPid = 1;
    scheduledCallback?.();
    assert.equal(exitedWithCode, 0);

    stopWatching();
});

test('startOrphanExitWatch exits immediately when already orphaned', () => {
    let exitedWithCode: number | undefined;
    let scheduled = false;

    startOrphanExitWatch({
        enabled: true,
        exit: (code) => {
            exitedWithCode = code;
        },
        getParentPid: () => 1,
        logger: {
            log: () => undefined,
        },
        setInterval: () => {
            scheduled = true;
            return setInterval(() => undefined, 1000);
        },
    });

    assert.equal(exitedWithCode, 0);
    assert.equal(scheduled, false);
});

test('startOrphanExitWatch stays disabled when orphan exits are turned off', () => {
    let scheduled = false;

    startOrphanExitWatch({
        enabled: false,
        exit: () => undefined,
        getParentPid: () => 4242,
        setInterval: () => {
            scheduled = true;
            return setInterval(() => undefined, 1000);
        },
    });

    assert.equal(scheduled, false);
});
