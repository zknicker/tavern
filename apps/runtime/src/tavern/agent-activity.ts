import type { AgentRuntimeAgentActivityEntry } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { listRecentAgentTurns } from './agent-turn-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { listChatsForAgentParticipant } from './chat-api/index.ts';

// Agent activity feed (specs/agent-activity.md): a turn-grained projection
// over durable turn rows and session-reset receipts. Turns float on the
// session (I1) — entries carry no chat anchor; replies are ordinary chat
// messages the agent sent via the CLI, not turn outcomes.

const defaultLimit = 20;
const maxLimit = 50;

export function listAgentActivity(
    input: { agentId: string; limit?: number },
    db: Database = getDb()
): AgentRuntimeAgentActivityEntry[] {
    const limit = Math.min(Math.max(input.limit ?? defaultLimit, 1), maxLimit);
    const entries: AgentRuntimeAgentActivityEntry[] = [];

    for (const turn of listRecentAgentTurns({ agentId: input.agentId, limit }, db)) {
        entries.push({
            at: turn.createdAt,
            detail: turn.kind === 'start' ? 'Session start' : null,
            kind: 'message_received',
            turnId: turn.id,
        });
        if (turn.completedAt && turn.status !== 'queued' && turn.status !== 'running') {
            entries.push({
                at: turn.completedAt,
                detail:
                    turn.status === 'failed' && typeof turn.metadata.error === 'string'
                        ? turn.metadata.error
                        : null,
                kind:
                    turn.status === 'failed'
                        ? 'failed'
                        : turn.status === 'cancelled'
                          ? 'stopped'
                          : 'completed',
                turnId: turn.id,
            });
        }
    }
    entries.push(...newSessionEntries(input.agentId, limit, db));

    return entries.sort((left, right) => (left.at < right.at ? 1 : -1)).slice(0, limit);
}

// Manual resets land a durable system receipt in the agent's built-in DM
// (specs/sessions.md); the full-vs-session distinction rides the text.
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
            `SELECT content, created_at
             FROM chat_messages
             WHERE chat_id = $chatId
               AND role = 'system'
               AND json_extract(metadata_json, '$.runtime.notice') = 'new_session'
             ORDER BY created_at DESC
             LIMIT $limit`
        )
        .all(namedParams({ chatId: dm.id, limit })) as {
        content: string;
        created_at: string;
    }[];

    return rows.map((row) => ({
        at: row.created_at,
        detail: resetReason(row.content),
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
