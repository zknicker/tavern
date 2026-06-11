import assert from 'node:assert/strict';
import test from 'node:test';
import { engineRestartToastAction } from './use-engine-restart-toast.ts';

test('starts one toast per restart cycle', () => {
    assert.equal(engineRestartToastAction(false, 'scheduled'), 'start');
    assert.equal(engineRestartToastAction(true, 'scheduled'), 'ignore');
    assert.equal(engineRestartToastAction(true, 'restarting'), 'ignore');
});

test('starts mid-cycle when the first observed phase is restarting', () => {
    assert.equal(engineRestartToastAction(false, 'restarting'), 'start');
});

test('completed resolves an active toast and is ignored otherwise', () => {
    assert.equal(engineRestartToastAction(true, 'completed'), 'complete');
    assert.equal(engineRestartToastAction(false, 'completed'), 'ignore');
});

test('unknown phases are ignored', () => {
    assert.equal(engineRestartToastAction(false, 'mystery'), 'ignore');
    assert.equal(engineRestartToastAction(true, ''), 'ignore');
});
