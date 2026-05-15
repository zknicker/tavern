import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSharedCargoTargetDirectory,
    getTauriEnvironment,
    shouldUseSharedCargoTargetDirectory,
} from './tauri-environment.mjs';

test('uses a shared Cargo target directory for tauri dev', () => {
    const tauriEnvironment = getTauriEnvironment({
        baseEnvironment: { PATH: '/usr/bin' },
        commandArguments: ['dev'],
        hasSccache: true,
        homeDirectory: '/Users/tester',
        platform: 'darwin',
        warn: () => undefined,
    });

    assert.equal(tauriEnvironment.RUSTC_WRAPPER, 'sccache');
    assert.equal(
        tauriEnvironment.CARGO_TARGET_DIR,
        '/Users/tester/Library/Caches/Tavern/tauri-target'
    );
});

test('preserves explicit Cargo and Rust overrides', () => {
    const tauriEnvironment = getTauriEnvironment({
        baseEnvironment: {
            CARGO_TARGET_DIR: '/tmp/custom-target',
            PATH: '/usr/bin',
            RUSTC_WRAPPER: 'custom-wrapper',
        },
        commandArguments: ['dev'],
        hasSccache: true,
        homeDirectory: '/Users/tester',
        platform: 'darwin',
        warn: () => undefined,
    });

    assert.equal(tauriEnvironment.RUSTC_WRAPPER, 'custom-wrapper');
    assert.equal(tauriEnvironment.CARGO_TARGET_DIR, '/tmp/custom-target');
});

test('does not force a shared Cargo target directory outside tauri dev', () => {
    const tauriEnvironment = getTauriEnvironment({
        baseEnvironment: { PATH: '/usr/bin' },
        commandArguments: ['build'],
        hasSccache: false,
        homeDirectory: '/Users/tester',
        platform: 'darwin',
        warn: () => undefined,
    });

    assert.equal(tauriEnvironment.CARGO_TARGET_DIR, undefined);
});

test('builds the shared Cargo target path on Linux', () => {
    const targetDirectory = getSharedCargoTargetDirectory({
        baseEnvironment: { XDG_CACHE_HOME: '/tmp/cache-root' },
        homeDirectory: '/home/tester',
        platform: 'linux',
    });

    assert.equal(targetDirectory, '/tmp/cache-root/tavern/tauri-target');
});

test('identifies the tauri dev command', () => {
    assert.equal(shouldUseSharedCargoTargetDirectory(['dev']), true);
    assert.equal(shouldUseSharedCargoTargetDirectory(['build']), false);
});
