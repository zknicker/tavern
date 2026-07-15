import type { AgentRuntimeAgentSessionSummary } from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { listAgentSessionsForAgent } from './agent-session-store.ts';

export interface AgentSessionStats {
    /**
     * Context size after the session's latest completed turn, from the
     * harness-reported usage on that turn's response. Null until a turn
     * reports usage.
     */
    contextTokens: number | null;
    /** Turns run in this session, excluding dismissed evidence. */
    turnCount: number;
}

/**
 * Aggregates the session's durable turn evidence for the agent drawer. The
 * session is agent-global, so stats span every chat it worked in.
 */
export function readAgentSessionStats(input: {
    db?: Database;
    sessionId: string;
}): AgentSessionStats {
    const db = input.db ?? getDb();
    const row = db
        .prepare(
            `SELECT
                COUNT(*) AS turn_count,
                (SELECT json_extract(metadata_json, '$.runtime.contextTokens')
                 FROM chat_responses
                 WHERE deleted_at IS NULL
                   AND json_extract(metadata_json, '$.runtime.agentSessionId') = $sessionId
                   AND json_extract(metadata_json, '$.runtime.contextTokens') IS NOT NULL
                 ORDER BY updated_at DESC, id DESC
                 LIMIT 1) AS context_tokens
             FROM chat_responses
             WHERE deleted_at IS NULL
               AND json_extract(metadata_json, '$.runtime.agentSessionId') = $sessionId`
        )
        .get(namedParams({ sessionId: input.sessionId })) as {
        context_tokens: number | null;
        turn_count: number;
    };

    return {
        contextTokens: typeof row.context_tokens === 'number' ? row.context_tokens : null,
        turnCount: row.turn_count,
    };
}

/**
 * The agent's earlier sessions as list-row summaries, newest first. Excludes
 * the current session and never exposes resume state.
 */
export function readPastAgentSessionSummaries(input: {
    agentId: string;
    currentSessionId: string | null;
    db?: Database;
}): AgentRuntimeAgentSessionSummary[] {
    const db = input.db ?? getDb();
    const turnCounts = readAgentTurnCounts(db);

    return listAgentSessionsForAgent(input.agentId, db)
        .filter((session) => session.id !== input.currentSessionId)
        .sort((left, right) => right.generation - left.generation)
        .map((session) => ({
            archivedAt: session.archivedAt,
            createdAt: session.createdAt,
            effectiveModel: session.effectiveModel,
            id: session.id,
            status: session.status,
            turnCount: turnCounts.get(session.id) ?? 0,
            updatedAt: session.updatedAt,
        }));
}

function readAgentTurnCounts(db: Database): Map<string, number> {
    const rows = db
        .prepare(
            `SELECT json_extract(metadata_json, '$.runtime.agentSessionId') AS session_id,
                    COUNT(*) AS turn_count
             FROM chat_responses
             WHERE deleted_at IS NULL
               AND json_extract(metadata_json, '$.runtime.agentSessionId') IS NOT NULL
             GROUP BY session_id`
        )
        .all() as { session_id: string; turn_count: number }[];

    return new Map(rows.map((row) => [row.session_id, row.turn_count]));
}
