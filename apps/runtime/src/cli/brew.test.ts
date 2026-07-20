import { beforeEach, describe, expect, test, vi } from 'vitest';

const spawnSyncMock = vi.fn();
vi.mock('node:child_process', () => ({
    spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

const { brew } = await import('./brew');

function spawnResult(result: Record<string, unknown>) {
    return { status: 0, stdout: '', stderr: '', error: undefined, ...result };
}

beforeEach(() => {
    spawnSyncMock.mockReset();
});

describe('brew.isRuntimeOutdated', () => {
    test('exit 0 and empty stdout → up to date', () => {
        spawnSyncMock.mockReturnValue(spawnResult({ status: 0, stdout: '' }));
        expect(brew.isRuntimeOutdated()).toBe(false);
    });

    test('exit 1 with formula name → outdated', () => {
        spawnSyncMock.mockReturnValue(spawnResult({ status: 1, stdout: 'tavern-runtime\n' }));
        expect(brew.isRuntimeOutdated()).toBe(true);
    });

    test('exit 0 but stdout has the name → outdated', () => {
        spawnSyncMock.mockReturnValue(spawnResult({ status: 0, stdout: 'tavern-runtime\n' }));
        expect(brew.isRuntimeOutdated()).toBe(true);
    });
});

describe('brew.isAvailable', () => {
    test('ENOENT spawn error → not available', () => {
        spawnSyncMock.mockReturnValue(
            spawnResult({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) })
        );
        expect(brew.isAvailable()).toBe(false);
    });

    test('successful spawn → available', () => {
        spawnSyncMock.mockReturnValue(spawnResult({ status: 0, stdout: 'Homebrew 4.0.0' }));
        expect(brew.isAvailable()).toBe(true);
    });
});

describe('Runtime formula selection', () => {
    test('uses the canonical Grotto formula when installed', () => {
        spawnSyncMock.mockReturnValue(spawnResult({ status: 0 }));

        brew.upgradeRuntime();

        expect(spawnSyncMock).toHaveBeenLastCalledWith(
            'brew',
            ['upgrade', 'grotto-runtime'],
            expect.any(Object)
        );
    });

    test('keeps upgrading the legacy formula for existing installs', () => {
        spawnSyncMock
            .mockReturnValueOnce(spawnResult({ status: 1 }))
            .mockReturnValueOnce(spawnResult({ status: 0 }))
            .mockReturnValueOnce(spawnResult({ status: 0 }));

        brew.upgradeRuntime();

        expect(spawnSyncMock).toHaveBeenLastCalledWith(
            'brew',
            ['upgrade', 'tavern-runtime'],
            expect.any(Object)
        );
    });
});
