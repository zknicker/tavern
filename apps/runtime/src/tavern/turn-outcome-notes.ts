import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import type { AgentTurn } from './agent-turn-store.ts';

// Turn-outcome signal for agent-to-agent dispatch (specs/agent-mentions.md):
// when a mention-dispatched turn settles, the requesting agent's seat gets one
// compact note — succeeded / failed / stopped / silent, plus the reply message
// id — delivered in its next prompt instead of via transcript polling.

export type AgentTurnOutcomeStatus = 'completed' | 'failed' | 'no_reply' | 'stopped';

export interface AgentTurnOutcomeNote {
    createdAt: string;
    error: null | string;
    id: string;
    recipientAgentId: string;
    recipientChatId: string;
    replyMessageId: null | string;
    status: AgentTurnOutcomeStatus;
    targetAgentId: string;
    targetChatId: string;
    turnId: string;
}

interface AgentTurnOutcomeNoteRow {
    created_at: string;
    error: null | string;
    id: string;
    recipient_agent_id: string;
    recipient_chat_id: string;
    reply_message_id: null | string;
    status: AgentTurnOutcomeStatus;
    target_agent_id: string;
    target_chat_id: string;
    turn_id: string;
}

/**
 * Records the settled turn's outcome for the seat that dispatched it. No-op
 * for turns without dispatch metadata (user- or automation-triggered turns)
 * and idempotent per turn, so every settle path can call it safely.
 */
export function recordAgentTurnOutcomeNote(
    turn: AgentTurn,
    result: { error?: string; status: 'cancelled' | 'completed' | 'failed' },
    db: Database = getDb()
) {
    const dispatchedBy = readDispatchedBy(turn.metadata);
    if (!dispatchedBy) {
        return null;
    }

    const status: AgentTurnOutcomeStatus =
        result.status === 'cancelled'
            ? 'stopped'
            : result.status === 'failed'
              ? 'failed'
              : turn.outputMessageIds.length === 0
                ? 'no_reply'
                : 'completed';
    const id = `tno_${turn.id}`.replace(/[^A-Za-z0-9_-]/g, '_');
    db.prepare(
        `INSERT OR IGNORE INTO agent_turn_outcome_notes (
            id, turn_id, recipient_agent_id, recipient_chat_id,
            target_agent_id, target_chat_id, status, reply_message_id,
            error, created_at
         )
         VALUES (
            $id, $turnId, $recipientAgentId, $recipientChatId,
            $targetAgentId, $targetChatId, $status, $replyMessageId,
            $error, $createdAt
         )`
    ).run(
        namedParams({
            createdAt: new Date().toISOString(),
            error: result.error ?? null,
            id,
            recipientAgentId: dispatchedBy.agentId,
            recipientChatId: dispatchedBy.chatId,
            replyMessageId: status === 'completed' ? (turn.outputMessageIds.at(-1) ?? null) : null,
            status,
            targetAgentId: turn.agentId,
            targetChatId: turn.chatId,
            turnId: turn.id,
        })
    );
    return id;
}

/**
 * Pending notes for one seat, oldest first, marked consumed by the reading
 * turn. Called while composing that turn's prompt.
 */
export function consumeAgentTurnOutcomeNotes(
    input: { agentId: string; chatId: string; runId: string },
    db: Database = getDb()
): AgentTurnOutcomeNote[] {
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_turn_outcome_notes
             WHERE recipient_agent_id = $agentId
               AND recipient_chat_id = $chatId
               AND consumed_at IS NULL
             ORDER BY created_at ASC, id ASC`
        )
        .all(
            namedParams({ agentId: input.agentId, chatId: input.chatId })
        ) as AgentTurnOutcomeNoteRow[];
    if (rows.length === 0) {
        return [];
    }

    const now = new Date().toISOString();
    const consume = db.prepare(
        `UPDATE agent_turn_outcome_notes
         SET consumed_at = $now, consumed_by_run_id = $runId
         WHERE id = $id AND consumed_at IS NULL`
    );
    for (const row of rows) {
        consume.run(namedParams({ id: row.id, now, runId: input.runId }));
    }
    return rows.map(rowToNote);
}

function readDispatchedBy(metadata: Record<string, unknown>) {
    const value = metadata.dispatchedBy;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const agentId = record.agentId;
    const chatId = record.chatId;
    if (typeof agentId !== 'string' || !agentId || typeof chatId !== 'string' || !chatId) {
        return null;
    }
    return { agentId, chatId };
}

function rowToNote(row: AgentTurnOutcomeNoteRow): AgentTurnOutcomeNote {
    return {
        createdAt: row.created_at,
        error: row.error,
        id: row.id,
        recipientAgentId: row.recipient_agent_id,
        recipientChatId: row.recipient_chat_id,
        replyMessageId: row.reply_message_id,
        status: row.status,
        targetAgentId: row.target_agent_id,
        targetChatId: row.target_chat_id,
        turnId: row.turn_id,
    };
}
