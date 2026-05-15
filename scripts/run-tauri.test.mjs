import assert from 'node:assert/strict';
import test from 'node:test';
import { getTauriArguments } from './run-tauri.mjs';

test('adds the updater feature for packaged desktop builds', () => {
    assert.deepEqual(getTauriArguments({ commandArguments: ['build'] }), [
        'build',
        '--features',
        'updater',
    ]);
});

test('preserves existing build features while adding updater', () => {
    assert.deepEqual(getTauriArguments({ commandArguments: ['build', '--features', 'foo'] }), [
        'build',
        '--features',
        'foo',
        '--features',
        'updater',
    ]);
});

test('does not duplicate an existing updater build feature', () => {
    assert.deepEqual(getTauriArguments({ commandArguments: ['build', '--features=updater'] }), [
        'build',
        '--features=updater',
    ]);
});

test('does not add the updater feature to dev builds', () => {
    assert.deepEqual(getTauriArguments({ commandArguments: ['dev'] }), [
        'dev',
        '--config',
        JSON.stringify({
            build: {
                devUrl: 'http://localhost:3100',
            },
        }),
    ]);
});
