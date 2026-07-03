import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeEvent, SemanticMemoryFreshness } from '@tavern/api';
import { type FSWatcher, watch } from 'chokidar';
import { log } from '../../log.ts';
import { publishRuntimeEvent } from '../../tavern/runtime-events.ts';

interface SemanticMemoryConfig {
    memoryPath: string;
}

type SemanticMemoryConfigResolver = () => Promise<SemanticMemoryConfig> | SemanticMemoryConfig;

interface SemanticMemoryWatcherOptions {
    pollIntervalMs?: number;
    usePolling?: boolean;
}

interface ActiveSemanticMemoryWatcher {
    root: string;
    watcher: FSWatcher;
}

const debounceMs = 400;
const maxPathHints = 100;

let activeWatcher: ActiveSemanticMemoryWatcher | null = null;
let configResolver: SemanticMemoryConfigResolver | null = null;
let watcherOptions: SemanticMemoryWatcherOptions = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pendingPaths = new Set<string>();
let pendingBulk = false;
let freshness: SemanticMemoryFreshness = {
    live: false,
    reason: 'Memory live updates have not started.',
    state: 'idle',
};

export async function startSemanticMemoryWatcher(
    resolveConfig: SemanticMemoryConfigResolver,
    options: SemanticMemoryWatcherOptions = {}
) {
    configResolver = resolveConfig;
    watcherOptions = options;
    await restartSemanticMemoryWatcher({ emitRootChanged: false });
}

export async function restartSemanticMemoryWatcher({
    emitRootChanged = true,
}: {
    emitRootChanged?: boolean;
} = {}) {
    if (!configResolver) {
        return;
    }

    const config = await configResolver();
    const root = path.resolve(config.memoryPath);
    const watchRoot = await resolveWatchRoot(root);

    if (activeWatcher?.root === watchRoot && freshness.state === 'watching') {
        if (emitRootChanged) {
            publishSemanticMemoryChanged({ reason: 'settings', scope: 'root' });
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
            recordSemanticMemoryPathChange([watchRoot, root], changedPath, eventName);
        });
        nextWatcher.on('error', (error) => {
            degradeSemanticMemoryFreshness(error);
            publishSemanticMemoryChanged({ reason: 'watch', scope: 'root' });
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
        log.info('Watching Memory root for live updates', {
            memoryPath: root,
            watchPath: watchRoot,
        });
        if (emitRootChanged) {
            publishSemanticMemoryChanged({ reason: 'settings', scope: 'root' });
        }
    } catch (error) {
        if (watcher && activeWatcher?.watcher === watcher) {
            await closeActiveWatcher();
        }
        degradeSemanticMemoryFreshness(error);
        log.warn('Memory live updates unavailable', { err: error, memoryPath: root });
        if (emitRootChanged) {
            publishSemanticMemoryChanged({ reason: 'settings', scope: 'root' });
        }
    }
}

export async function closeSemanticMemoryWatcher() {
    clearPendingFlush();
    pendingPaths.clear();
    pendingBulk = false;
    configResolver = null;
    watcherOptions = {};
    await closeActiveWatcher();
    freshness = {
        live: false,
        reason: 'Memory live updates have stopped.',
        state: 'idle',
    };
}

export function getSemanticMemoryWatcherFreshness(): SemanticMemoryFreshness {
    return freshness;
}

function recordSemanticMemoryPathChange(roots: string[], changedPath: string, eventName: string) {
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
        publishSemanticMemoryChanged({ paths, reason, scope: 'content' });
    }, debounceMs);
}

function publishSemanticMemoryChanged(input: {
    paths?: string[];
    reason: NonNullable<Extract<AgentRuntimeEvent, { type: 'semanticMemory.changed' }>['reason']>;
    scope: Extract<AgentRuntimeEvent, { type: 'semanticMemory.changed' }>['scope'];
}) {
    publishRuntimeEvent({
        paths: input.paths ?? [],
        reason: input.reason,
        scope: input.scope,
        timestamp: new Date().toISOString(),
        type: 'semanticMemory.changed',
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

function degradeSemanticMemoryFreshness(error: unknown) {
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
    const relativePath = toSemanticMemoryRelativePath(roots, changedPath);
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
    const relativePath = toSemanticMemoryRelativePath(roots, candidatePath);
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

function toSemanticMemoryRelativePath(roots: string[], candidatePath: string) {
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
