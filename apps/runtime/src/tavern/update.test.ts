import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
    spawn: spawnMock,
}));

describe('Runtime update', () => {
    beforeEach(() => {
        spawnMock.mockReset();
        vi.resetModules();
    });

    it('stages the Runtime update without restarting the service', async () => {
        const child = createChildProcess();
        spawnMock.mockReturnValue(child);
        const update = await import('./update.ts');

        const status = update.startRuntimeUpdate({ targetVersion: '1.2.3' });

        expect(status).toMatchObject({
            phase: 'installing',
            targetVersion: '1.2.3',
        });
        expect(spawnMock).toHaveBeenCalledWith(
            'sh',
            ['-lc', 'brew update && brew upgrade tavern-runtime'],
            expect.objectContaining({
                stdio: 'ignore',
            })
        );

        child.emit('exit', 0);

        expect(update.getRuntimeUpdateStatus()).toMatchObject({
            phase: 'staged',
            targetVersion: '1.2.3',
        });
    });

    it('restarts Runtime only through the explicit restart step', async () => {
        const child = createChildProcess();
        spawnMock.mockReturnValue(child);
        const update = await import('./update.ts');

        const status = update.restartRuntimeForUpdate();

        expect(status.phase).toBe('restarting');
        expect(spawnMock).toHaveBeenCalledWith(
            'sh',
            ['-lc', 'brew services restart tavern-runtime'],
            expect.objectContaining({
                detached: true,
                stdio: 'ignore',
            })
        );
        expect(child.unref).toHaveBeenCalled();
    });
});

function createChildProcess() {
    return Object.assign(new EventEmitter(), {
        unref: vi.fn(),
    });
}
