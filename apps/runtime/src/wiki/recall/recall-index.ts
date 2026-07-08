import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { QMDStore } from '@tobilu/qmd';
import { DATA_DIR } from '../../config.ts';
import { log } from '../../log.ts';
import { subscribeToRuntimeEvents } from '../../tavern/runtime-events.ts';
import { resolveWikiConfig } from '../store.ts';
import { loadQmd } from './qmd-loader.ts';

/**
 * Recall index over shared Wiki pages, backed by the qmd search
 * engine. The Markdown pages stay canonical; this index is derived, rebuildable
 * state under the Runtime data directory. Embeddings use qmd's local model,
 * downloaded on first provisioning — never during a turn.
 */

export interface RecallIndexOptions {
    dbPath?: string;
    wikiRoot?: string;
}

interface ActiveRecallIndex {
    root: string;
    store: QMDStore;
}

export type RecallProvisioningPhase =
    | 'degraded'
    | 'downloading-model'
    | 'embedding'
    | 'idle'
    | 'ready'
    | 'updating';

export interface RecallProvisioningStatus {
    phase: RecallProvisioningPhase;
    progress: number | null;
    reason: string | null;
}

const recallCollection = 'wiki';
const refreshDebounceMs = 2000;
// A failed refresh (offline model download, missing SQLite extension) retries
// on its own schedule; waiting for the next page change could leave recall
// degraded indefinitely on a quiet Wiki root.
const degradedRetryMs = 5 * 60 * 1000;
// qmd's default embedding model (embeddinggemma-300M-Q8_0) download size, used
// only to shape download progress; the poll clamps below 1 so an off estimate
// never reports a finished download early.
const embeddingModelTargetBytes = 320 * 1024 * 1024;
const downloadPollMs = 1000;
const capabilityPushThrottleMs = 1000;

let active: ActiveRecallIndex | null = null;
let vectorReady = false;
let embedFailureLogged = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let overrides: RecallIndexOptions = {};
let provisioning: RecallProvisioningStatus = { phase: 'idle', progress: null, reason: null };
let downloadPoller: ReturnType<typeof setInterval> | null = null;
let lastCapabilityPushAt = 0;

export async function ensureRecallStore(): Promise<QMDStore> {
    const root = await resolveRecallRoot();
    if (active?.root === root) {
        return active.store;
    }

    await closeRecallIndex();
    const { createStore } = await loadQmd();
    const store = await createStore({
        config: {
            collections: {
                [recallCollection]: { path: root, pattern: '**/*.md' },
            },
        },
        dbPath: overrides.dbPath ?? path.join(DATA_DIR, 'wiki-recall.sqlite'),
    });
    active = { root, store };
    return store;
}

export function isRecallVectorReady() {
    return vectorReady;
}

export function getRecallProvisioningStatus(): RecallProvisioningStatus {
    return provisioning;
}

/** Re-scan pages into the lex index without touching embedding models. */
export async function updateRecallIndex() {
    const store = await ensureRecallStore();
    await store.update();
}

export interface RecallIndexAudit {
    pendingEmbeddings: number;
    totalPages: number;
    vectorIndexReady: boolean;
}

/**
 * Drift audit for the capability check: re-scan the Wiki root (hash-diff,
 * cheap) and report pages the vector index has not embedded yet. Lost watcher
 * events therefore surface as visible pending work within one capability poll
 * instead of silently stale recall — and the audit schedules the healing
 * refresh itself.
 */
export async function auditRecallIndex(): Promise<RecallIndexAudit> {
    const store = await ensureRecallStore();
    await store.update();
    const status = await store.getStatus();
    if (status.needsEmbedding > 0) {
        scheduleRecallRefresh();
    }
    return {
        pendingEmbeddings: status.needsEmbedding,
        totalPages: status.totalDocuments,
        vectorIndexReady: status.hasVectorIndex,
    };
}

/**
 * Re-scan pages and refresh embeddings. Embedding failures (for example the
 * model download failing offline) degrade recall to unavailable instead of
 * failing the caller; the next refresh retries.
 */
export async function refreshRecallIndex() {
    setProvisioning({ phase: 'updating', progress: null, reason: null });
    const store = await ensureRecallStore();
    await store.update();
    try {
        startModelDownloadTracking();
        await store.embed({
            onProgress: (info) => {
                stopModelDownloadTracking();
                setProvisioning({
                    phase: 'embedding',
                    progress: info.totalChunks > 0 ? info.chunksEmbedded / info.totalChunks : null,
                    reason: null,
                });
            },
        });
        vectorReady = true;
        embedFailureLogged = false;
        setProvisioning({ phase: 'ready', progress: null, reason: null });
    } catch (error) {
        vectorReady = false;
        const reason = error instanceof Error ? error.message : String(error);
        setProvisioning({ phase: 'degraded', progress: null, reason });
        if (!embedFailureLogged) {
            embedFailureLogged = true;
            log.warn('Wiki recall embeddings unavailable; retrying in the background', {
                err: error,
            });
        }
        scheduleRecallRefresh(degradedRetryMs);
    } finally {
        stopModelDownloadTracking();
    }
}

export function startRecallIndexMaintenance(options: RecallIndexOptions = {}) {
    overrides = options;

    unsubscribe?.();
    unsubscribe = subscribeToRuntimeEvents((event) => {
        if (event.type !== 'wiki.changed') {
            return;
        }
        if (event.scope === 'root') {
            // Root moves invalidate the collection binding; rebuild the store.
            void closeRecallIndex().then(() => scheduleRecallRefresh());
            return;
        }
        scheduleRecallRefresh();
    });

    void refreshRecallIndex().catch((error) => {
        log.warn('Wiki recall index initialization failed', { err: error });
    });
    log.info('Wiki recall index maintenance started');
}

export async function closeRecallIndex() {
    const current = active;
    active = null;
    vectorReady = false;
    await current?.store.close();
}

export async function stopRecallIndexMaintenance() {
    unsubscribe?.();
    unsubscribe = null;
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    stopModelDownloadTracking();
    await closeRecallIndex();
}

export async function resetRecallIndexForTesting(options: RecallIndexOptions = {}) {
    await stopRecallIndexMaintenance();
    overrides = options;
    embedFailureLogged = false;
    provisioning = { phase: 'idle', progress: null, reason: null };
    lastCapabilityPushAt = 0;
}

function scheduleRecallRefresh(delayMs = refreshDebounceMs) {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refreshRecallIndex().catch((error) => {
            log.warn('Wiki recall index refresh failed', { err: error });
        });
    }, delayMs);
}

async function resolveRecallRoot() {
    if (overrides.wikiRoot) {
        return path.resolve(overrides.wikiRoot);
    }
    const config = await resolveWikiConfig();
    return path.resolve(config.wikiPath);
}

function setProvisioning(next: RecallProvisioningStatus) {
    const phaseChanged = provisioning.phase !== next.phase;
    provisioning = next;
    pushRecallCapability(phaseChanged);
}

// The embedding model downloads inside the first embed call with no progress
// hook, so shape progress from the model cache directory size while waiting
// for the first embed progress event.
function startModelDownloadTracking() {
    if (downloadPoller || embeddingModelCached()) {
        return;
    }
    setProvisioning({ phase: 'downloading-model', progress: 0, reason: null });
    downloadPoller = setInterval(() => {
        const progress = Math.min(modelCacheBytes() / embeddingModelTargetBytes, 0.99);
        setProvisioning({ phase: 'downloading-model', progress, reason: null });
    }, downloadPollMs);
}

function stopModelDownloadTracking() {
    if (!downloadPoller) {
        return;
    }
    clearInterval(downloadPoller);
    downloadPoller = null;
}

function qmdModelCacheDir() {
    return path.join(os.homedir(), '.cache', 'qmd', 'models');
}

function embeddingModelCached() {
    try {
        return fs
            .readdirSync(qmdModelCacheDir())
            .some((name) => name.includes('embeddinggemma') && name.endsWith('.gguf'));
    } catch {
        return false;
    }
}

function modelCacheBytes() {
    try {
        const dir = qmdModelCacheDir();
        return fs
            .readdirSync(dir)
            .reduce((total, name) => total + fs.statSync(path.join(dir, name)).size, 0);
    } catch {
        return 0;
    }
}

// Lazy import: the capabilities store depends on capability definitions, which
// read this module's provisioning status — a static import here would close
// that cycle. Push failures only delay the next capability poll.
// Phase changes bypass the throttle: it exists to absorb same-phase progress
// ticks, and dropping a terminal push would freeze the UI on a stale state
// (a yellow 100% bar) until the next scheduled capability poll.
function pushRecallCapability(force = false) {
    const now = Date.now();
    if (!force && now - lastCapabilityPushAt < capabilityPushThrottleMs) {
        return;
    }
    lastCapabilityPushAt = now;
    void import('../../capabilities/store.ts')
        .then((capabilities) =>
            capabilities.refreshRuntimeCapabilities({
                ids: ['wikiRecall'],
                publishUpdated: true,
            })
        )
        .catch(() => {
            // Capability refresh is best-effort; the scheduled poll catches up.
        });
}
