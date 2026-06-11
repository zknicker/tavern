import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeCronList } from '@tavern/api';
import { wikiUpkeepCronName } from '../hermes/managed-crons';
import { listCortexTopics } from './store';

const pendingCountThreshold = 5;
const settleMs = 15 * 60 * 1000;
const triggerCooldownMs = 60 * 60 * 1000;

const logEntryPattern = /^## \[(?<date>\d{4}-\d{2}-\d{2})[^\]]*\] (?<op>[a-z-]+) \|(?<rest>.*)$/u;
const rawPathPattern = /\((?<rawPath>raw\/[^()]+\.md)\)\s*$/u;
const compileOps = new Set(['compile', 'research']);
const ingestOps = new Set(['ingest', 'ingest-collection']);

export interface PendingCompileTopic {
    newestPendingAtMs: null | number;
    pendingCount: number;
    topic: string;
}

export interface CompileTriggerClient {
    listCronJobs(): Promise<AgentRuntimeCronList>;
    runCronJob(jobId: string): Promise<unknown>;
}

export type CompileTriggerOutcome =
    | { kind: 'idle' }
    | { kind: 'skipped'; reason: 'cooldown' | 'cron-missing' | 'cron-paused'; topics: string[] }
    | { kind: 'triggered'; topics: string[] };

/**
 * Fires the wiki upkeep automation when uncompiled raw sources pile up —
 * llm-wiki's 5-source compile nudge. Smaller ingests wait for the daily upkeep
 * run, which bounds their delay already. The check itself is pure filesystem
 * work — the agent only runs when there is real compile work — and the
 * cooldown keeps one trigger from queueing several runs.
 */
export async function runWikiCompileTrigger(
    client: CompileTriggerClient,
    nowMs: number = Date.now()
): Promise<CompileTriggerOutcome> {
    const pending = await listPendingCompileTopics();
    const topics = pending
        .filter((topic) => isCompileTriggerDue(topic, nowMs))
        .map((topic) => topic.topic);
    if (topics.length === 0) {
        return { kind: 'idle' };
    }

    const { jobs } = await client.listCronJobs();
    const upkeep = jobs.find((job) => job.managed && job.name === wikiUpkeepCronName);
    if (!upkeep) {
        return { kind: 'skipped', reason: 'cron-missing', topics };
    }
    if (!upkeep.enabled) {
        return { kind: 'skipped', reason: 'cron-paused', topics };
    }
    const lastRunAtMs = upkeep.state.lastRunAtMs ?? null;
    const busy =
        upkeep.state.lastRunStatus === 'queued' || upkeep.state.lastRunStatus === 'running';
    if (busy || (lastRunAtMs !== null && nowMs - lastRunAtMs < triggerCooldownMs)) {
        return { kind: 'skipped', reason: 'cooldown', topics };
    }

    await client.runCronJob(upkeep.id);
    return { kind: 'triggered', topics };
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

export function isCompileTriggerDue(pending: PendingCompileTopic, nowMs: number): boolean {
    if (pending.pendingCount < pendingCountThreshold) {
        return false;
    }
    return pending.newestPendingAtMs === null || nowMs - pending.newestPendingAtMs >= settleMs;
}

async function readPendingForTopic(slug: string, topicPath: string): Promise<PendingCompileTopic> {
    const empty: PendingCompileTopic = {
        newestPendingAtMs: null,
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
