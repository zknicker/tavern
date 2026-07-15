import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

export type AgentTurnStatus = 'cancelled' | 'completed' | 'failed' | 'queued' | 'running';

export interface AgentTurn {
    activityIds: string[];
    agentId: string;
    agentParticipantId: string;
    agentSessionId: string;
    attempt: number;
    chatId: string;
    completedAt: null | string;
    createdAt: string;
    id: string;
    metadata: Record<string, unknown>;
    outputMessageIds: string[];
    responseId: string;
    startedAt: null | string;
    status: AgentTurnStatus;
    triggerMessageId: string;
    updatedAt: string;
}

interface AgentTurnRow {
    activity_ids_json: string;
    agent_id: string;
    agent_participant_id: string;
    agent_session_id: string;
    attempt: number;
    chat_id: string;
    completed_at: null | string;
    created_at: string;
    id: string;
    metadata_json: string;
    output_message_ids_json: string;
    response_id: string;
    started_at: null | string;
    status: AgentTurnStatus;
    trigger_message_id: string;
    updated_at: string;
}

export function createAgentTurn(
    input: {
        agentId: string;
        agentParticipantId: string;
        agentSessionId: string;
        chatId: string;
        id: string;
        metadata?: Record<string, unknown>;
        now?: string;
        responseId: string;
        triggerMessageId: string;
    },
    db: Database = getDb()
) {
    const now = input.now ?? new Date().toISOString();
    const existing = getAgentTurn(input.id, db);
    if (existing) {
        return existing;
    }

    db.prepare(
        `INSERT INTO agent_turns (
            id,
            chat_id,
            agent_session_id,
            agent_participant_id,
            agent_id,
            trigger_message_id,
            response_id,
            status,
            attempt,
            output_message_ids_json,
            activity_ids_json,
            metadata_json,
            created_at,
            updated_at,
            started_at,
            completed_at
         )
         VALUES (
            $id,
            $chatId,
            $agentSessionId,
            $agentParticipantId,
            $agentId,
            $triggerMessageId,
            $responseId,
            'queued',
            $attempt,
            '[]',
            '[]',
            $metadataJson,
            $now,
            $now,
            NULL,
            NULL
         )`
    ).run(
        namedParams({
            agentId: input.agentId,
            agentParticipantId: input.agentParticipantId,
            agentSessionId: input.agentSessionId,
            attempt: nextAttempt(input, db),
            chatId: input.chatId,
            id: input.id,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            now,
            responseId: input.responseId,
            triggerMessageId: input.triggerMessageId,
        })
    );

    return getAgentTurnOrThrow(input.id, db);
}

export interface AgentTurnPromptEvidence {
    capturedAt: string;
    instructions: string;
    // False on resumed turns: harness adapters deliver instructions only on a
    // session's first prompt, so the composed text above was not sent.
    instructionsDelivered?: boolean;
    prompt: string;
    recall: Array<{ path: string; score: number; snippet: string; title: string }>;
}

/**
 * Durable record of exactly what one turn's model call received: composed
 * instructions, the per-turn prompt, and the Wiki recall hits injected into
 * it. Written at turn start so evidence survives crashed turns; read by the
 * turn-prompt inspection route.
 */
export function recordAgentTurnPromptEvidence(
    input: { evidence: AgentTurnPromptEvidence; id: string; now?: string },
    db: Database = getDb()
) {
    const turn = getAgentTurnOrThrow(input.id, db);
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_turns
         SET metadata_json = $metadataJson,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            id: input.id,
            metadataJson: JSON.stringify({ ...turn.metadata, promptEvidence: input.evidence }),
            now,
        })
    );
}

export function getAgentTurnPromptEvidence(
    id: string,
    db: Database = getDb()
): AgentTurnPromptEvidence | null {
    const turn = getAgentTurn(id, db);
    const evidence = turn?.metadata.promptEvidence;
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
        return null;
    }
    return evidence as unknown as AgentTurnPromptEvidence;
}

export function getAgentTurn(id: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM agent_turns WHERE id = $id LIMIT 1')
        .get(namedParams({ id })) as AgentTurnRow | null;
    return row ? rowToAgentTurn(row) : null;
}

export function getAgentTurnOrThrow(id: string, db: Database = getDb()) {
    const turn = getAgentTurn(id, db);
    if (!turn) {
        throw new Error(`Missing agent turn ${id}.`);
    }
    return turn;
}

export function listAgentTurnsForSession(agentSessionId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE agent_session_id = $agentSessionId
             ORDER BY created_at ASC, id ASC`
        )
        .all(namedParams({ agentSessionId })) as AgentTurnRow[];
    return rows.map(rowToAgentTurn);
}

// The agent's currently running turn, wherever it is anchored. Busy
// delivery targets this turn (specs/steering.md).
export function findRunningAgentTurnForAgent(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE agent_id = $agentId
               AND status = 'running'
             ORDER BY started_at DESC, id DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId })) as AgentTurnRow | null;
    return row ? rowToAgentTurn(row) : null;
}

// Whether the agent has any work in flight anywhere (queued or running).
// A seat is busy exactly when its agent is busy (specs/sessions.md).
export function hasUnsettledAgentTurnsForAgent(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT 1 AS present
             FROM agent_turns
             WHERE agent_id = $agentId
               AND status IN ('queued', 'running')
             LIMIT 1`
        )
        .get(namedParams({ agentId })) as { present: number } | null;
    return Boolean(row);
}

// Every in-flight turn across all agents, running first then oldest
// queued: the source for agent presence (specs/presence.md).
export function listUnsettledAgentTurns(db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE status IN ('queued', 'running')
             ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, created_at ASC, id ASC`
        )
        .all() as AgentTurnRow[];
    return rows.map(rowToAgentTurn);
}

// One turn at a time per agent, across all chats (specs/sessions.md). The
// queue drains oldest-first regardless of chat — auto-drain is the runner
// re-claiming after every settle.
export function claimNextAgentTurnForAgent(
    input: {
        agentId: string;
        now?: string;
    },
    db: Database = getDb()
) {
    const running = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE agent_id = $agentId
               AND status = 'running'
             ORDER BY started_at ASC, id ASC
             LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId })) as AgentTurnRow | null;
    if (running) {
        return null;
    }

    const next = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE agent_id = $agentId
               AND status = 'queued'
             ORDER BY created_at ASC, id ASC
             LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId })) as AgentTurnRow | null;
    if (!next) {
        return null;
    }

    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_turns
         SET status = 'running',
             started_at = COALESCE(started_at, $now),
             updated_at = $now
         WHERE id = $id AND status = 'queued'`
    ).run(namedParams({ id: next.id, now }));
    return getAgentTurnOrThrow(next.id, db);
}

export function completeAgentTurn(
    input: {
        activityIds: string[];
        id: string;
        now?: string;
        outputMessageIds: string[];
    },
    db: Database = getDb()
) {
    return finishAgentTurn(
        {
            activityIds: input.activityIds,
            id: input.id,
            now: input.now,
            outputMessageIds: input.outputMessageIds,
            status: 'completed',
        },
        db
    );
}

export function failAgentTurn(
    input: {
        activityIds?: string[];
        error: string;
        id: string;
        now?: string;
        outputMessageIds?: string[];
    },
    db: Database = getDb()
) {
    const turn = getAgentTurnOrThrow(input.id, db);
    return finishAgentTurn(
        {
            activityIds: input.activityIds ?? turn.activityIds,
            id: input.id,
            metadata: { ...turn.metadata, error: input.error },
            now: input.now,
            outputMessageIds: input.outputMessageIds ?? turn.outputMessageIds,
            status: 'failed',
        },
        db
    );
}

export function cancelAgentTurn(input: { id: string; now?: string }, db: Database = getDb()) {
    const turn = getAgentTurn(input.id, db);
    if (!(turn && ['queued', 'running'].includes(turn.status))) {
        return null;
    }
    return finishAgentTurn(
        {
            activityIds: turn.activityIds,
            id: input.id,
            now: input.now,
            outputMessageIds: turn.outputMessageIds,
            status: 'cancelled',
        },
        db
    );
}

function finishAgentTurn(
    input: {
        activityIds: string[];
        id: string;
        metadata?: Record<string, unknown>;
        now?: string;
        outputMessageIds: string[];
        status: Extract<AgentTurnStatus, 'cancelled' | 'completed' | 'failed'>;
    },
    db: Database
) {
    const now = input.now ?? new Date().toISOString();
    const metadata = input.metadata ?? getAgentTurnOrThrow(input.id, db).metadata;
    db.prepare(
        `UPDATE agent_turns
         SET status = $status,
             output_message_ids_json = $outputMessageIdsJson,
             activity_ids_json = $activityIdsJson,
             metadata_json = $metadataJson,
             updated_at = $now,
             completed_at = COALESCE(completed_at, $now)
         WHERE id = $id`
    ).run(
        namedParams({
            activityIdsJson: JSON.stringify(input.activityIds),
            id: input.id,
            metadataJson: JSON.stringify(metadata),
            now,
            outputMessageIdsJson: JSON.stringify(input.outputMessageIds),
            status: input.status,
        })
    );
    return getAgentTurnOrThrow(input.id, db);
}

function nextAttempt(input: { agentSessionId: string; triggerMessageId: string }, db: Database) {
    const row = db
        .prepare(
            `SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt
             FROM agent_turns
             WHERE agent_session_id = $agentSessionId
               AND trigger_message_id = $triggerMessageId`
        )
        .get(
            namedParams({
                agentSessionId: input.agentSessionId,
                triggerMessageId: input.triggerMessageId,
            })
        ) as { attempt: number };
    return row.attempt;
}

function rowToAgentTurn(row: AgentTurnRow): AgentTurn {
    return {
        activityIds: parseStringArray(row.activity_ids_json),
        agentId: row.agent_id,
        agentParticipantId: row.agent_participant_id,
        agentSessionId: row.agent_session_id,
        attempt: row.attempt,
        chatId: row.chat_id,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        id: row.id,
        metadata: parseRecord(row.metadata_json),
        outputMessageIds: parseStringArray(row.output_message_ids_json),
        responseId: row.response_id,
        startedAt: row.started_at,
        status: row.status,
        triggerMessageId: row.trigger_message_id,
        updatedAt: row.updated_at,
    };
}

function parseStringArray(value: string) {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')
        ? parsed
        : [];
}

function parseRecord(value: string) {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
}
