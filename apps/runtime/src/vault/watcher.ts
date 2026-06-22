import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeEvent, VaultFreshness } from '@tavern/api';
import { type FSWatcher, watch } from 'chokidar';
import { log } from '../log.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

interface VaultConfig {
    vaultPath: string;
}

type VaultConfigResolver = () => Promise<VaultConfig> | VaultConfig;

interface VaultWatcherOptions {
    pollIntervalMs?: number;
    usePolling?: boolean;
}

interface ActiveVaultWatcher {
    root: string;
    watcher: FSWatcher;
}

const debounceMs = 400;
const maxPathHints = 100;

let activeWatcher: ActiveVaultWatcher | null = null;
let configResolver: VaultConfigResolver | null = null;
let watcherOptions: VaultWatcherOptions = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pendingPaths = new Set<string>();
let pendingBulk = false;
let freshness: VaultFreshness = {
    live: false,
    reason: 'Vault live updates have not started.',
    state: 'idle',
};

export async function startVaultWatcher(
    resolveConfig: VaultConfigResolver,
    options: VaultWatcherOptions = {}
) {
    configResolver = resolveConfig;
    watcherOptions = options;
    await restartVaultWatcher({ emitRootChanged: false });
}

export async function restartVaultWatcher({
    emitRootChanged = true,
}: {
    emitRootChanged?: boolean;
} = {}) {
    if (!configResolver) {
        return;
    }

    const config = await configResolver();
    const root = path.resolve(config.vaultPath);
    const watchRoot = await resolveWatchRoot(root);

    if (activeWatcher?.root === watchRoot && freshness.state === 'watching') {
        if (emitRootChanged) {
            publishVaultChanged({ reason: 'settings', scope: 'root' });
        }
        return;
    }

    await closeActiveWatcher();

    let watcher: FSWatcher | null = null;
    try {
        const nextWatcher = watch(watchRoot, {
            followSymlinks: false,
            ignored: (candidatePath, stats) =>
                shouldIgnoreWatchPath([watchRoot, root], candidatePath, stats),
            ignoreInitial: true,
            ignorePermissionErrors: true,
            interval: watcherOptions.pollIntervalMs,
            persistent: true,
            usePolling: watcherOptions.usePolling ?? false,
        });
        watcher = nextWatcher;

        nextWatcher.on('all', (eventName, changedPath) => {
            recordVaultPathChange([watchRoot, root], changedPath, eventName);
        });
        nextWatcher.on('error', (error) => {
            degradeVaultFreshness(error);
            publishVaultChanged({ reason: 'watch', scope: 'root' });
        });
        activeWatcher = { root: watchRoot, watcher: nextWatcher };

        await new Promise<void>((resolve, reject) => {
            nextWatcher.once('ready', resolve);
            nextWatcher.once('error', reject);
        });

        if (activeWatcher?.watcher !== nextWatcher) {
            return;
        }

        freshness = {
            live: true,
            reason: null,
            state: 'watching',
        };
        log.info('Watching Vault root for live updates', { vaultPath: root, watchPath: watchRoot });
        if (emitRootChanged) {
            publishVaultChanged({ reason: 'settings', scope: 'root' });
        }
    } catch (error) {
        if (watcher && activeWatcher?.watcher === watcher) {
            await closeActiveWatcher();
        }
        degradeVaultFreshness(error);
        log.warn('Vault live updates unavailable', { err: error, vaultPath: root });
        if (emitRootChanged) {
            publishVaultChanged({ reason: 'settings', scope: 'root' });
        }
    }
}

export async function closeVaultWatcher() {
    clearPendingFlush();
    pendingPaths.clear();
    pendingBulk = false;
    configResolver = null;
    watcherOptions = {};
    await closeActiveWatcher();
    freshness = {
        live: false,
        reason: 'Vault live updates have stopped.',
        state: 'idle',
    };
}

export function getVaultWatcherFreshness(): VaultFreshness {
    return freshness;
}

function recordVaultPathChange(roots: string[], changedPath: string, eventName: string) {
    const relativePath = normalizeChangedPath(roots, changedPath);
    if (!relativePath) {
        return;
    }

    if (eventName === 'addDir' || eventName === 'unlinkDir') {
        pendingPaths.clear();
        pendingBulk = true;
        scheduleFlush();
        return;
    }

    if (!relativePath.endsWith('.md')) {
        return;
    }

    pendingPaths.add(relativePath);
    if (pendingPaths.size > maxPathHints) {
        pendingPaths.clear();
        pendingBulk = true;
    }

    scheduleFlush();
}

function scheduleFlush() {
    if (flushTimer) {
        clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(() => {
        flushTimer = null;
        const paths = pendingBulk ? [] : [...pendingPaths].sort();
        const reason = pendingBulk ? 'bulk' : 'watch';
        pendingPaths.clear();
        pendingBulk = false;
        publishVaultChanged({ paths, reason, scope: 'content' });
    }, debounceMs);
}

function publishVaultChanged(input: {
    paths?: string[];
    reason: NonNullable<Extract<AgentRuntimeEvent, { type: 'vault.changed' }>['reason']>;
    scope: Extract<AgentRuntimeEvent, { type: 'vault.changed' }>['scope'];
}) {
    publishRuntimeEvent({
        paths: input.paths ?? [],
        reason: input.reason,
        scope: input.scope,
        timestamp: new Date().toISOString(),
        type: 'vault.changed',
    });
}

async function closeActiveWatcher() {
    const current = activeWatcher;
    activeWatcher = null;
    await current?.watcher.close();
}

function clearPendingFlush() {
    if (!flushTimer) {
        return;
    }
    clearTimeout(flushTimer);
    flushTimer = null;
}

function degradeVaultFreshness(error: unknown) {
    freshness = {
        live: false,
        reason: error instanceof Error ? error.message : String(error),
        state: 'degraded',
    };
}

async function resolveWatchRoot(root: string) {
    try {
        return await realpath(root);
    } catch {
        return root;
    }
}

function normalizeChangedPath(roots: string[], changedPath: string) {
    const relativePath = toVaultRelativePath(roots, changedPath);
    if (!relativePath) {
        return null;
    }
    if (hasDotSegment(relativePath)) {
        return null;
    }
    return relativePath;
}

function shouldIgnoreWatchPath(
    roots: string[],
    candidatePath: string,
    stats?: { isDirectory(): boolean; isFile(): boolean }
) {
    const relativePath = toVaultRelativePath(roots, candidatePath);
    if (!relativePath) {
        return false;
    }
    if (hasDotSegment(relativePath)) {
        return true;
    }
    if (stats?.isDirectory()) {
        return false;
    }
    if (stats?.isFile()) {
        return !relativePath.endsWith('.md');
    }
    return false;
}

function toVaultRelativePath(roots: string[], candidatePath: string) {
    for (const root of roots) {
        const absolutePath = path.isAbsolute(candidatePath)
            ? candidatePath
            : path.join(root, candidatePath);
        const relativePath = path.relative(root, absolutePath).replace(/\\/gu, '/');
        if (relativePath && !relativePath.startsWith('../') && relativePath !== '..') {
            return relativePath;
        }
    }
    return null;
}

function hasDotSegment(relativePath: string) {
    return relativePath.split('/').some((segment) => segment.startsWith('.'));
}
