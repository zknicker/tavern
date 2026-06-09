import fs from 'node:fs/promises';
import path from 'node:path';

const pollIntervalMs = 2000;
const waitDeadlineMs = 15 * 60 * 1000;
const staleAfterMs = 30 * 60 * 1000;

interface LockMeta {
    pid: number;
    startedAt: string;
}

/**
 * Cross-process mutex for the shared engine root. Concurrent Runtime startups
 * (multiple worktrees, or service + CLI) wait for one install instead of
 * racing the installer.
 */
export async function withEngineInstallLock<T>(
    engineRootPath: string,
    fn: () => Promise<T>
): Promise<T> {
    const lockDir = path.join(engineRootPath, '.install-lock');
    await acquire(lockDir);
    try {
        return await fn();
    } finally {
        await fs.rm(lockDir, { force: true, recursive: true }).catch(() => undefined);
    }
}

async function acquire(lockDir: string): Promise<void> {
    const deadline = Date.now() + waitDeadlineMs;

    while (true) {
        try {
            await fs.mkdir(lockDir, { recursive: false });
            await writeMeta(lockDir);
            return;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                // Engine root does not exist yet; create it and retry.
                await fs.mkdir(path.dirname(lockDir), { recursive: true });
                continue;
            }
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw err;
            }
        }

        if (await isStale(lockDir)) {
            await fs.rm(lockDir, { force: true, recursive: true }).catch(() => undefined);
            continue;
        }

        if (Date.now() >= deadline) {
            throw new Error(
                `Timed out waiting for another agent engine install to finish (lock: ${lockDir}).`
            );
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
}

async function writeMeta(lockDir: string): Promise<void> {
    const meta: LockMeta = { pid: process.pid, startedAt: new Date().toISOString() };
    await fs.writeFile(path.join(lockDir, 'meta.json'), JSON.stringify(meta));
}

async function isStale(lockDir: string): Promise<boolean> {
    const meta = await readMeta(lockDir);
    if (!meta) {
        // Unreadable meta on an existing lock: trust mtime alone.
        return await isOlderThanStaleWindow(lockDir);
    }
    if (!isProcessAlive(meta.pid)) {
        return true;
    }
    return await isOlderThanStaleWindow(lockDir);
}

async function readMeta(lockDir: string): Promise<LockMeta | null> {
    try {
        const raw = await fs.readFile(path.join(lockDir, 'meta.json'), 'utf8');
        const parsed = JSON.parse(raw) as Partial<LockMeta>;
        return typeof parsed.pid === 'number'
            ? { pid: parsed.pid, startedAt: parsed.startedAt ?? '' }
            : null;
    } catch {
        return null;
    }
}

async function isOlderThanStaleWindow(lockDir: string): Promise<boolean> {
    try {
        const stat = await fs.stat(lockDir);
        return Date.now() - stat.mtimeMs > staleAfterMs;
    } catch {
        return false;
    }
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
