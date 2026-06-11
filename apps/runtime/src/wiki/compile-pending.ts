import fs from 'node:fs/promises';
import path from 'node:path';
import { readWikiLogEntries, type WikiLogEntry } from './log';
import { listCortexTopics } from './store';

const pendingCountThreshold = 5;
const pendingAgeMs = 6 * 60 * 60 * 1000;
const settleMs = 15 * 60 * 1000;

const rawPathPattern = /\((?<rawPath>raw\/[^()]+\.md)\)\s*$/u;
const compileOps = new Set(['compile', 'research']);
const ingestOps = new Set(['ingest', 'ingest-collection']);

export interface PendingCompileTopic {
    newestPendingAtMs: null | number;
    oldestPendingAtMs: null | number;
    pendingCount: number;
    topic: string;
}

/**
 * Counts unprocessed source material per active topic: uncompiled raw sources
 * from `log.md` order — ingest entries after the last compile (or research,
 * which compiles inline) entry — plus files dropped in `inbox/` that have not
 * been ingested yet. Timestamps come from file mtimes, falling back to log
 * entry dates.
 */
export async function listPendingCompileTopics(): Promise<PendingCompileTopic[]> {
    const { topics } = await listCortexTopics();
    const results = await Promise.all(
        topics.map((topic) => readPendingForTopic(topic.slug, topic.path))
    );
    return results.filter((topic) => topic.pendingCount > 0);
}

/**
 * Compile when a batch piles up (llm-wiki's 5-source nudge) or a straggler has
 * waited past the age limit — small ingests batch, nothing waits forever. The
 * settle window lets an in-flight ingest batch finish first.
 */
export function isCompileDue(pending: PendingCompileTopic, nowMs: number): boolean {
    if (pending.pendingCount === 0) {
        return false;
    }
    if (pending.newestPendingAtMs !== null && nowMs - pending.newestPendingAtMs < settleMs) {
        return false;
    }
    if (pending.pendingCount >= pendingCountThreshold) {
        return true;
    }
    return pending.oldestPendingAtMs !== null && nowMs - pending.oldestPendingAtMs >= pendingAgeMs;
}

async function readPendingForTopic(slug: string, topicPath: string): Promise<PendingCompileTopic> {
    const empty: PendingCompileTopic = {
        newestPendingAtMs: null,
        oldestPendingAtMs: null,
        pendingCount: 0,
        topic: slug,
    };
    const entries = await readWikiLogEntries(topicPath);
    let lastCompileIndex = -1;
    for (const [index, entry] of entries.entries()) {
        if (compileOps.has(entry.op)) {
            lastCompileIndex = index;
        }
    }
    const pendingEntries = entries
        .slice(lastCompileIndex + 1)
        .filter((entry) => ingestOps.has(entry.op));
    const [logTimestamps, inboxTimestamps] = await Promise.all([
        Promise.all(pendingEntries.map((entry) => readIngestTimestamp(topicPath, entry))),
        listInboxTimestamps(topicPath),
    ]);
    const timestamps = [...logTimestamps, ...inboxTimestamps];
    if (timestamps.length === 0) {
        return empty;
    }

    return {
        newestPendingAtMs: Math.max(...timestamps),
        oldestPendingAtMs: Math.min(...timestamps),
        pendingCount: timestamps.length,
        topic: slug,
    };
}

/** Files dropped in `inbox/` count as pending sources until ingest sweeps them. */
async function listInboxTimestamps(topicPath: string): Promise<number[]> {
    try {
        const inboxPath = path.join(topicPath, 'inbox');
        const entries = await fs.readdir(inboxPath, { withFileTypes: true });
        const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.'));
        const stats = await Promise.all(
            files.map((entry) => fs.stat(path.join(inboxPath, entry.name)))
        );
        return stats.map((stat) => stat.mtimeMs);
    } catch {
        return [];
    }
}

async function readIngestTimestamp(topicPath: string, entry: WikiLogEntry): Promise<number> {
    const rawPath = rawPathPattern.exec(entry.rest)?.groups?.rawPath;
    if (rawPath) {
        try {
            const stat = await fs.stat(path.join(topicPath, rawPath));
            return stat.mtimeMs;
        } catch {
            // Logged raw file missing or renamed — fall back to the entry date.
        }
    }
    return Date.parse(`${entry.date}T00:00:00Z`);
}
