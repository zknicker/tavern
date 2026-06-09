import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withEngineInstallLock } from './bootstrap-lock';

describe('engine install lock', () => {
    let root: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-engine-lock-'));
    });

    afterEach(async () => {
        await fs.rm(root, { force: true, recursive: true });
    });

    it('serializes concurrent holders', async () => {
        const order: string[] = [];

        const first = withEngineInstallLock(root, async () => {
            order.push('first-start');
            await new Promise((resolve) => setTimeout(resolve, 150));
            order.push('first-end');
        });
        // Give the first holder time to acquire before contending.
        await new Promise((resolve) => setTimeout(resolve, 50));
        const second = withEngineInstallLock(root, async () => {
            order.push('second-start');
        });

        await Promise.all([first, second]);

        expect(order).toEqual(['first-start', 'first-end', 'second-start']);
    }, 15_000);

    it('releases the lock when the holder throws', async () => {
        await expect(
            withEngineInstallLock(root, () => Promise.reject(new Error('boom')))
        ).rejects.toThrow('boom');

        // Immediate reacquire proves the lock dir is gone.
        await withEngineInstallLock(root, async () => undefined);
    });

    it('breaks a stale lock held by a dead process', async () => {
        const lockDir = path.join(root, '.install-lock');
        await fs.mkdir(lockDir, { recursive: true });
        const deadPid = spawnSync('true').pid as number;
        await fs.writeFile(
            path.join(lockDir, 'meta.json'),
            JSON.stringify({ pid: deadPid, startedAt: new Date().toISOString() })
        );

        let ran = false;
        await withEngineInstallLock(root, async () => {
            ran = true;
        });

        expect(ran).toBe(true);
    }, 15_000);
});
