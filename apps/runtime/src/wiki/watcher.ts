import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeEvent, WikiFreshness } from '@tavern/api';
import { type FSWatcher, watch } from 'chokidar';
import { log } from '../log.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { commitWikiHistory } from './history.ts';

interface WikiConfig {
    wikiPath: string;
}

type WikiConfigResolver = () => Promise<WikiConfig> | WikiConfig;

interface WikiWatcherOptions {
    pollIntervalMs?: number;
    usePolling?: boolean;
}

interface ActiveWikiWatcher {
    root: string;
    watcher: FSWatcher;
}

const debounceMs = 400;
const maxPathHints = 100;

let activeWatcher: ActiveWikiWatcher | null = null;
let configResolver: WikiConfigResolver | null = null;
let watcherOptions: WikiWatcherOptions = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pendingPaths = new Set<string>();
let pendingBulk = false;
let freshness: WikiFreshness = {
    live: false,
    reason: 'Wiki live updates have not started.',
    state: 'idle',
};

export async function startWikiWatcher(
    resolveConfig: WikiConfigResolver,
    options: WikiWatcherOptions = {}
) {
    configResolver = resolveConfig;
    watcherOptions = options;
    await restartWikiWatcher({ emitRootChanged: false });
}

export async function restartWikiWatcher({
    emitRootChanged = true,
}: {
    emitRootChanged?: boolean;
} = {}) {
    if (!configResolver) {
        return;
    }

    const config = await configResolver();
    const root = path.resolve(config.wikiPath);
    const watchRoot = await resolveWatchRoot(root);

    if (activeWatcher?.root === watchRoot && freshness.state === 'watching') {
        if (emitRootChanged) {
            publishWikiChanged({ reason: 'settings', scope: 'root' });
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
            recordWikiPathChange([watchRoot, root], changedPath, eventName);
        });
        nextWatcher.on('error', (error) => {
            degradeWikiFreshness(error);
            publishWikiChanged({ reason: 'watch', scope: 'root' });
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
        log.info('Watching Wiki root for live updates', {
            wikiPath: root,
            watchPath: watchRoot,
        });
        if (emitRootChanged) {
            publishWikiChanged({ reason: 'settings', scope: 'root' });
        }
    } catch (error) {
        if (watcher && activeWatcher?.watcher === watcher) {
            await closeActiveWatcher();
        }
        degradeWikiFreshness(error);
        log.warn('Wiki live updates unavailable', { err: error, wikiPath: root });
        if (emitRootChanged) {
            publishWikiChanged({ reason: 'settings', scope: 'root' });
        }
    }
}

export async function closeWikiWatcher() {
    clearPendingFlush();
    pendingPaths.clear();
    pendingBulk = false;
    configResolver = null;
    watcherOptions = {};
    await closeActiveWatcher();
    freshness = {
        live: false,
        reason: 'Wiki live updates have stopped.',
        state: 'idle',
    };
}

export function getWikiWatcherFreshness(): WikiFreshness {
    return freshness;
}

function recordWikiPathChange(roots: string[], changedPath: string, eventName: string) {
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
        void flushPendingChanges();
    }, debounceMs);
}

async function flushPendingChanges() {
    flushTimer = null;
    const paths = pendingBulk ? [] : [...pendingPaths].sort();
    const reason = pendingBulk ? 'bulk' : 'watch';
    pendingPaths.clear();
    pendingBulk = false;

    await commitExternalWikiChanges(reason);
    publishWikiChanged({ paths, reason, scope: 'content' });
}

async function commitExternalWikiChanges(reason: 'bulk' | 'watch') {
    if (!configResolver) {
        return;
    }
    try {
        const config = await configResolver();
        await commitWikiHistory(config.wikiPath, {
            reason: reason === 'bulk' ? 'external bulk change' : 'external change',
        });
    } catch (error) {
        log.warn('Wiki local history update failed', { err: error });
    }
}

function publishWikiChanged(input: {
    paths?: string[];
    reason: NonNullable<Extract<AgentRuntimeEvent, { type: 'wiki.changed' }>['reason']>;
    scope: Extract<AgentRuntimeEvent, { type: 'wiki.changed' }>['scope'];
}) {
    publishRuntimeEvent({
        paths: input.paths ?? [],
        reason: input.reason,
        scope: input.scope,
        timestamp: new Date().toISOString(),
        type: 'wiki.changed',
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

function degradeWikiFreshness(error: unknown) {
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
    const relativePath = toWikiRelativePath(roots, changedPath);
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
    const relativePath = toWikiRelativePath(roots, candidatePath);
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

function toWikiRelativePath(roots: string[], candidatePath: string) {
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
