import path from 'node:path';
import type { QMDStore } from '@tobilu/qmd';
import { DATA_DIR } from '../../config.ts';
import { log } from '../../log.ts';
import { subscribeToRuntimeEvents } from '../../tavern/runtime-events.ts';
import { resolveSemanticMemoryConfig } from '../semantic/store.ts';
import { isMemoryEnabled } from '../settings.ts';
import { loadQmd } from './qmd-loader.ts';

/**
 * Recall index over shared Semantic Memory pages, backed by the qmd search
 * engine. The Markdown pages stay canonical; this index is derived, rebuildable
 * state under the Runtime data directory. Embeddings use qmd's local model,
 * downloaded on first provisioning — never during a turn.
 */

export interface RecallIndexOptions {
    dbPath?: string;
    memoryRoot?: string;
}

interface ActiveRecallIndex {
    root: string;
    store: QMDStore;
}

const recallCollection = 'memory';
const refreshDebounceMs = 2000;

let active: ActiveRecallIndex | null = null;
let semanticReady = false;
let embedFailureLogged = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let overrides: RecallIndexOptions = {};

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
        dbPath: overrides.dbPath ?? path.join(DATA_DIR, 'memory-recall.sqlite'),
    });
    active = { root, store };
    return store;
}

export function isRecallSemanticReady() {
    return semanticReady;
}

/** Re-scan pages into the lex index without touching embedding models. */
export async function updateRecallIndex() {
    const store = await ensureRecallStore();
    await store.update();
}

/**
 * Re-scan pages and refresh embeddings. Embedding failures (for example the
 * model download failing offline) degrade recall to unavailable instead of
 * failing the caller; the next refresh retries.
 */
export async function refreshRecallIndex() {
    const store = await ensureRecallStore();
    await store.update();
    try {
        await store.embed();
        semanticReady = true;
        embedFailureLogged = false;
    } catch (error) {
        semanticReady = false;
        if (!embedFailureLogged) {
            embedFailureLogged = true;
            log.warn('Memory recall embeddings unavailable; recall is degraded until refresh', {
                err: error,
            });
        }
    }
}

export function startRecallIndexMaintenance(options: RecallIndexOptions = {}) {
    overrides = options;
    if (!isMemoryEnabled()) {
        return;
    }

    unsubscribe?.();
    unsubscribe = subscribeToRuntimeEvents((event) => {
        if (event.type !== 'semanticMemory.changed') {
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
        log.warn('Memory recall index initialization failed', { err: error });
    });
    log.info('Memory recall index maintenance started');
}

export async function closeRecallIndex() {
    const current = active;
    active = null;
    semanticReady = false;
    await current?.store.close();
}

export async function stopRecallIndexMaintenance() {
    unsubscribe?.();
    unsubscribe = null;
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    await closeRecallIndex();
}

export async function resetRecallIndexForTesting(options: RecallIndexOptions = {}) {
    await stopRecallIndexMaintenance();
    overrides = options;
    embedFailureLogged = false;
}

function scheduleRecallRefresh() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refreshRecallIndex().catch((error) => {
            log.warn('Memory recall index refresh failed', { err: error });
        });
    }, refreshDebounceMs);
}

async function resolveRecallRoot() {
    if (overrides.memoryRoot) {
        return path.resolve(overrides.memoryRoot);
    }
    const config = await resolveSemanticMemoryConfig();
    return path.resolve(config.memoryPath);
}
