import fs from 'node:fs/promises';
import path from 'node:path';
import { listCortexTopics } from './store';

const pendingCountThreshold = 5;
const pendingAgeMs = 6 * 60 * 60 * 1000;
const settleMs = 15 * 60 * 1000;

const logEntryPattern = /^## \[(?<date>\d{4}-\d{2}-\d{2})[^\]]*\] (?<op>[a-z-]+) \|(?<rest>.*)$/u;
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
 * Counts uncompiled raw sources per active topic from `log.md` order — the
 * append-only llm-wiki activity log. Ingest entries after the last compile (or
 * research, which compiles inline) entry are pending; timestamps come from the
 * ingested raw file's mtime, falling back to the log entry date.
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
    let logContent: string;
    try {
        logContent = await fs.readFile(path.join(topicPath, 'log.md'), 'utf8');
    } catch {
        return empty;
    }

    const entries = logContent
        .split('\n')
        .map((line) => logEntryPattern.exec(line)?.groups)
        .filter((groups): groups is { date: string; op: string; rest: string } => Boolean(groups));
    let lastCompileIndex = -1;
    for (const [index, entry] of entries.entries()) {
        if (compileOps.has(entry.op)) {
            lastCompileIndex = index;
        }
    }
    const pendingEntries = entries
        .slice(lastCompileIndex + 1)
        .filter((entry) => ingestOps.has(entry.op));
    if (pendingEntries.length === 0) {
        return empty;
    }

    const timestamps = await Promise.all(
        pendingEntries.map((entry) => readIngestTimestamp(topicPath, entry))
    );
    return {
        newestPendingAtMs: Math.max(...timestamps),
        oldestPendingAtMs: Math.min(...timestamps),
        pendingCount: pendingEntries.length,
        topic: slug,
    };
}

async function readIngestTimestamp(
    topicPath: string,
    entry: { date: string; rest: string }
): Promise<number> {
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
