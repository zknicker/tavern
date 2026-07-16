import type { AgentRuntimeAgentActivityEntry, TavernChatMessage } from '@tavern/api';
import { getCronJob } from '../cron/store.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getTask } from '../tasks/store.ts';
import { type AgentTurn, listRecentAgentTurns } from './agent-turn-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    getChat,
    getMessage,
    getResponse,
    listChatsForAgentParticipant,
} from './chat-api/index.ts';

// Agent activity feed (specs/agent-activity.md): a turn-grained projection
// over durable turn rows and session notices — never a table, never an
// event stream. One turn yields at most two entries: its arrival and its
// outcome; a running turn shows only its arrival (presence says "working").

const defaultLimit = 20;
const maxLimit = 50;
const silentReplySummary = 'Chose not to reply.';

export function listAgentActivity(
    input: { agentId: string; limit?: number },
    db: Database = getDb()
): AgentRuntimeAgentActivityEntry[] {
    const limit = Math.min(Math.max(input.limit ?? defaultLimit, 1), maxLimit);
    const entries: AgentRuntimeAgentActivityEntry[] = [];

    for (const turn of listRecentAgentTurns({ agentId: input.agentId, limit }, db)) {
        entries.push(arrivalEntry(turn, db));
        const outcome = outcomeEntry(turn, db);
        if (outcome) {
            entries.push(outcome);
        }
    }
    entries.push(...newSessionEntries(input.agentId, limit, db));

    return entries.sort((left, right) => (left.at < right.at ? 1 : -1)).slice(0, limit);
}

function arrivalEntry(turn: AgentTurn, db: Database): AgentRuntimeAgentActivityEntry {
    const base = {
        at: turn.createdAt,
        chatId: turn.chatId,
        chatTitle: getChat(turn.chatId, db)?.title ?? null,
        turnId: turn.id,
    };
    const trigger = getMessage(turn.triggerMessageId, db);
    const tavern = readRecord(trigger?.metadata?.tavern);

    if (tavern.source === 'cron') {
        const jobId = typeof tavern.cronJobId === 'string' ? tavern.cronJobId : null;
        const job = jobId ? getCronJob(jobId, db) : null;
        return { ...base, detail: job?.name ?? null, kind: 'automation_fired' };
    }
    if (tavern.source === 'task-dispatch') {
        const taskId = typeof tavern.taskId === 'string' ? tavern.taskId : null;
        const task = taskId ? getTask(taskId, db) : null;
        return { ...base, detail: task?.title ?? null, kind: 'task_dispatched' };
    }
    return { ...base, detail: senderLabel(trigger), kind: 'message_received' };
}

function outcomeEntry(turn: AgentTurn, db: Database): AgentRuntimeAgentActivityEntry | null {
    if (!turn.completedAt || turn.status === 'queued' || turn.status === 'running') {
        return null;
    }
    const base = {
        at: turn.completedAt,
        chatId: turn.chatId,
        chatTitle: getChat(turn.chatId, db)?.title ?? null,
        detail: null,
        turnId: turn.id,
    };
    if (turn.status === 'failed') {
        return { ...base, kind: 'failed' };
    }
    if (turn.status === 'cancelled') {
        return { ...base, kind: 'stopped' };
    }
    const silent = getResponse(turn.responseId, db)?.summary === silentReplySummary;
    return { ...base, kind: silent ? 'declined' : 'replied' };
}

// Manual resets land a durable new_session notice in the agent's built-in
// DM (specs/sessions.md); the full-vs-session distinction rides the notice
// text, so the reason maps from it.
function newSessionEntries(
    agentId: string,
    limit: number,
    db: Database
): AgentRuntimeAgentActivityEntry[] {
    const participantId = createAgentParticipantId(agentId);
    const dm = listChatsForAgentParticipant(participantId, db).find((chat) => chat.kind === 'dm');
    if (!dm) {
        return [];
    }
    const rows = db
        .prepare(
            `SELECT completed_at, detail, started_at
             FROM chat_response_activity
             WHERE chat_id = $chatId
               AND json_extract(metadata_json, '$.runtime.notice.kind') = 'new_session'
             ORDER BY started_at DESC
             LIMIT $limit`
        )
        .all(namedParams({ chatId: dm.id, limit })) as {
        completed_at: null | string;
        detail: null | string;
        started_at: string;
    }[];

    return rows.map((row) => ({
        at: row.completed_at ?? row.started_at,
        chatId: null,
        chatTitle: null,
        detail: resetReason(row.detail),
        kind: 'new_session' as const,
        turnId: null,
    }));
}

function resetReason(noticeText: null | string) {
    if (noticeText?.startsWith('Started completely fresh')) {
        return 'full reset';
    }
    if (noticeText?.startsWith('Started a fresh session')) {
        return 'manual reset';
    }
    return null;
}

function senderLabel(message: TavernChatMessage | null | undefined) {
    return message?.author.label ?? message?.author.id ?? null;
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
