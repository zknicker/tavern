import type {
    AgentRuntimeCronRun,
    AgentRuntimeHighlightCategory,
    AgentRuntimeHighlightSourceRef,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { createLocalHermesClient } from '../hermes/local-client';
import { isUserTodo, listWikiTodos } from '../wiki/todos';
import { recentWindowMs, toolVolumeWindowMs } from './constants';
import { formatAgo, formatCount } from './format';
import { pickHeadline } from './phrases';
import type { HighlightCandidate } from './types';

interface CountRow {
    agent_id: null | string;
    agent_name: null | string;
    count: number;
}
interface TroubleRow {
    id: string;
    occurred_at: string;
    title: null | string;
    type: 'chatResponse' | 'responseActivity';
}

export async function buildHighlightCandidates(input: {
    cronRuns?: AgentRuntimeCronRun[];
    db: Database;
    now: Date;
    slotStart: Date;
}): Promise<HighlightCandidate[]> {
    const candidates = [
        buildToolVolumeHighlight(input),
        buildQuestFinishedHighlight(input),
        buildTroubleHighlight(input),
        await buildScheduledRunHighlight(input),
        await buildWikiAttentionHighlight(input),
    ];

    return candidates.filter((candidate): candidate is HighlightCandidate => Boolean(candidate));
}

/**
 * Surfaces wiki inventory follow-ups whose next action belongs to the user
 * (llm-wiki convention: `status: proposed` plus `owner: user`). The managed
 * wiki crons park human-gated work this way instead of nagging in chat.
 */
async function buildWikiAttentionHighlight(input: {
    now: Date;
    slotStart: Date;
}): Promise<HighlightCandidate | null> {
    const followUps = (await listWikiTodos()).filter(isUserTodo);
    if (followUps.length === 0) {
        return null;
    }

    const topics = [...new Set(followUps.map((todo) => todo.topic))];

    return createCandidate({
        category: 'wiki_attention',
        metric: {
            count: followUps.length,
            records: followUps.slice(0, 10).map((todo) => ({ path: todo.path, topic: todo.topic })),
            topics,
        },
        now: input.now,
        receipt: `${formatCount(followUps.length, 'wiki follow-up')} in ${formatCount(
            topics.length,
            'topic'
        )} waiting on your call in Cortex.`,
        slotStart: input.slotStart,
        sourceRefs: [],
        windowStart: input.slotStart,
    });
}

function buildToolVolumeHighlight(input: {
    db: Database;
    now: Date;
    slotStart: Date;
}): HighlightCandidate | null {
    const windowStart = new Date(input.now.getTime() - toolVolumeWindowMs);
    const row = input.db
        .prepare(
            `SELECT
                r.participant_id AS agent_id,
                agents.name AS agent_name,
                COUNT(*) AS count,
                MAX(COALESCE(a.completed_at, a.updated_at, a.started_at)) AS latest_at
             FROM chat_response_activity a
             JOIN chat_responses r ON r.id = a.response_id
             LEFT JOIN agents ON agents.id = r.participant_id
             WHERE a.kind IN ('tool_call', 'command')
               AND a.status = 'completed'
               AND COALESCE(a.completed_at, a.updated_at, a.started_at) >= $windowStart
             GROUP BY r.participant_id, agents.name
             ORDER BY count DESC, latest_at DESC
             LIMIT 1`
        )
        .get(namedParams({ windowStart: windowStart.toISOString() })) as CountRow | null;

    if (!row || row.count <= 0) {
        return null;
    }

    const agentName = row.agent_name ?? row.agent_id ?? 'Blippy';

    return createCandidate({
        category: 'tool_volume',
        metric: {
            agentId: row.agent_id,
            agentName,
            count: row.count,
        },
        now: input.now,
        receipt: `${agentName} completed ${formatCount(row.count, 'tool call')} in the past 24 hours.`,
        slotStart: input.slotStart,
        sourceRefs: [{ id: row.agent_id ?? 'all', type: 'responseActivity' }],
        windowStart,
    });
}

function buildQuestFinishedHighlight(input: {
    db: Database;
    now: Date;
    slotStart: Date;
}): HighlightCandidate | null {
    const windowStart = new Date(input.now.getTime() - recentWindowMs);
    const row = input.db
        .prepare(
            `SELECT
                r.participant_id AS agent_id,
                agents.name AS agent_name,
                COUNT(*) AS count,
                MAX(COALESCE(r.completed_at, r.updated_at, r.created_at)) AS latest_at
             FROM chat_responses r
             LEFT JOIN agents ON agents.id = r.participant_id
             WHERE r.status = 'completed'
               AND COALESCE(r.completed_at, r.updated_at, r.created_at) >= $windowStart
             GROUP BY r.participant_id, agents.name
             ORDER BY count DESC, latest_at DESC
             LIMIT 1`
        )
        .get(namedParams({ windowStart: windowStart.toISOString() })) as CountRow | null;

    if (!row || row.count <= 0) {
        return null;
    }

    const agentName = row.agent_name ?? row.agent_id ?? 'Blippy';

    return createCandidate({
        category: 'quest_finished',
        metric: {
            agentId: row.agent_id,
            agentName,
            count: row.count,
        },
        now: input.now,
        receipt: `${agentName} finished ${formatCount(row.count, 'quest')} in the past 3 hours.`,
        slotStart: input.slotStart,
        sourceRefs: [{ id: row.agent_id ?? 'all', type: 'chatResponse' }],
        windowStart,
    });
}

function buildTroubleHighlight(input: {
    db: Database;
    now: Date;
    slotStart: Date;
}): HighlightCandidate | null {
    const windowStart = new Date(input.now.getTime() - recentWindowMs);
    const row = input.db
        .prepare(
            `SELECT *
             FROM (
                SELECT
                    id,
                    COALESCE(completed_at, updated_at, started_at) AS occurred_at,
                    title,
                    'responseActivity' AS type
                FROM chat_response_activity
                WHERE status = 'failed'
                  AND COALESCE(completed_at, updated_at, started_at) >= $windowStart
                UNION ALL
                SELECT
                    id,
                    COALESCE(completed_at, updated_at, created_at) AS occurred_at,
                    summary AS title,
                    'chatResponse' AS type
                FROM chat_responses
                WHERE status = 'failed'
                  AND COALESCE(completed_at, updated_at, created_at) >= $windowStart
             )
             ORDER BY occurred_at DESC
             LIMIT 1`
        )
        .get(namedParams({ windowStart: windowStart.toISOString() })) as TroubleRow | null;

    if (!row) {
        return null;
    }

    return createCandidate({
        category: 'trouble',
        metric: {
            occurredAt: row.occurred_at,
            title: row.title,
            type: row.type,
        },
        now: input.now,
        receipt: `A quest failed ${formatAgo(input.now, row.occurred_at)} ago.`,
        slotStart: input.slotStart,
        sourceRefs: [{ id: row.id, type: row.type }],
        windowStart,
    });
}

async function buildScheduledRunHighlight(input: {
    cronRuns?: AgentRuntimeCronRun[];
    now: Date;
    slotStart: Date;
}): Promise<HighlightCandidate | null> {
    const windowStart = new Date(input.now.getTime() - recentWindowMs);
    const cronRuns = input.cronRuns ?? (await listCronRunsOrEmpty());
    const recentRuns = cronRuns.filter((run) => {
        const timestamp = run.finishedAt ?? run.startedAt ?? run.scheduledFor;
        return Date.parse(timestamp) >= windowStart.getTime();
    });

    if (recentRuns.length === 0) {
        return null;
    }

    const latest = [...recentRuns].sort((left, right) => {
        const leftTime = Date.parse(left.finishedAt ?? left.startedAt ?? left.scheduledFor);
        const rightTime = Date.parse(right.finishedAt ?? right.startedAt ?? right.scheduledFor);
        return rightTime - leftTime;
    })[0];

    return createCandidate({
        category: 'scheduled_run',
        metric: {
            count: recentRuns.length,
            latestStatus: latest?.status ?? null,
        },
        now: input.now,
        receipt: `${formatCount(recentRuns.length, 'scheduled quest')} ran in the past 3 hours.`,
        slotStart: input.slotStart,
        sourceRefs: recentRuns.slice(0, 5).map((run) => ({ id: run.id, type: 'cronRun' })),
        windowStart,
    });
}

function createCandidate(input: {
    category: AgentRuntimeHighlightCategory;
    metric: Record<string, unknown>;
    now: Date;
    receipt: string;
    slotStart: Date;
    sourceRefs: AgentRuntimeHighlightSourceRef[];
    windowStart: Date;
}): HighlightCandidate {
    return {
        category: input.category,
        headline: pickHeadline(input.category, input.slotStart),
        id: `${input.category}:${input.slotStart.toISOString()}`,
        metric: input.metric,
        receipt: input.receipt,
        sourceRefs: input.sourceRefs,
        windowEnd: input.now.toISOString(),
        windowStart: input.windowStart.toISOString(),
    };
}

async function listCronRunsOrEmpty(): Promise<AgentRuntimeCronRun[]> {
    const client = createLocalHermesClient();
    try {
        return (await client.listCronRuns()).runs;
    } catch {
        return [];
    } finally {
        client.close();
    }
}
