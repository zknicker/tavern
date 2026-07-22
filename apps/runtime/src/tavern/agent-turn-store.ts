import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

// Floating turns (I1): a turn anchors to the agent's global session, never a
// chat. `start` turns carry the bare Start. prompt; `drain` turns deliver
// pending inbox rows. Execution evidence (prompt, error) rides metadata.

export type AgentTurnKind = 'drain' | 'start';
export type AgentTurnStatus = 'cancelled' | 'completed' | 'failed' | 'queued' | 'running';

export interface AgentTurn {
    agentId: string;
    agentSessionId: string;
    completedAt: null | string;
    createdAt: string;
    id: string;
    kind: AgentTurnKind;
    metadata: Record<string, unknown>;
    startedAt: null | string;
    status: AgentTurnStatus;
    updatedAt: string;
}

interface AgentTurnRow {
    agent_id: string;
    agent_session_id: string;
    completed_at: null | string;
    created_at: string;
    id: string;
    kind: AgentTurnKind;
    metadata_json: string;
    started_at: null | string;
    status: AgentTurnStatus;
    updated_at: string;
}

export function createAgentTurn(
    input: {
        agentId: string;
        agentSessionId: string;
        id: string;
        kind: AgentTurnKind;
        metadata?: Record<string, unknown>;
        now?: string;
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
            id, agent_id, agent_session_id, kind, status, metadata_json,
            created_at, updated_at, started_at, completed_at
         )
         VALUES ($id, $agentId, $agentSessionId, $kind, 'queued', $metadataJson,
                 $now, $now, NULL, NULL)`
    ).run(
        namedParams({
            agentId: input.agentId,
            agentSessionId: input.agentSessionId,
            id: input.id,
            kind: input.kind,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            now,
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
}

/**
 * Durable record of exactly what one turn's model call received: composed
 * instructions and the per-turn prompt. Written at turn start so evidence
 * survives crashed turns; read by the turn-prompt inspection route.
 */
export function recordAgentTurnPromptEvidence(
    input: { evidence: AgentTurnPromptEvidence; id: string; now?: string },
    db: Database = getDb()
) {
    const turn = getAgentTurnOrThrow(input.id, db);
    mergeTurnMetadata(turn, { promptEvidence: input.evidence }, input.now, db);
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

// The agent's currently running turn. Inbox notices target this turn (I2).
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

// Whether the agent has any work in flight (queued or running).
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

// The agent's most recent turns, newest first: the source for the activity
// feed (specs/agent-activity.md).
export function listRecentAgentTurns(
    input: { agentId: string; limit: number },
    db: Database = getDb()
) {
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_turns
             WHERE agent_id = $agentId
             ORDER BY created_at DESC, id DESC
             LIMIT $limit`
        )
        .all(namedParams({ agentId: input.agentId, limit: input.limit })) as AgentTurnRow[];
    return rows.map(rowToAgentTurn);
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

// One turn at a time per agent. The queue drains oldest-first; auto-drain is
// the runner re-claiming after every settle.
export function claimNextAgentTurnForAgent(
    input: {
        agentId: string;
        now?: string;
    },
    db: Database = getDb()
) {
    const running = db
        .prepare(
            `SELECT 1 AS present
             FROM agent_turns
             WHERE agent_id = $agentId
               AND status = 'running'
             LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId })) as { present: number } | null;
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

export function hasQueuedAgentTurn(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT 1 AS present FROM agent_turns
             WHERE agent_id = $agentId AND status = 'queued' LIMIT 1`
        )
        .get(namedParams({ agentId })) as { present: number } | null;
    return Boolean(row);
}

export function completeAgentTurn(
    input: { contextTokens?: number | null; id: string; now?: string },
    db: Database = getDb()
) {
    const turn = getAgentTurnOrThrow(input.id, db);
    return finishAgentTurn(
        {
            id: input.id,
            metadata:
                input.contextTokens === null || input.contextTokens === undefined
                    ? turn.metadata
                    : { ...turn.metadata, contextTokens: input.contextTokens },
            now: input.now,
            status: 'completed',
        },
        db
    );
}

export function failAgentTurn(
    input: { error: string; id: string; now?: string },
    db: Database = getDb()
) {
    const turn = getAgentTurnOrThrow(input.id, db);
    return finishAgentTurn(
        {
            id: input.id,
            metadata: { ...turn.metadata, error: input.error },
            now: input.now,
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
        { id: input.id, metadata: turn.metadata, now: input.now, status: 'cancelled' },
        db
    );
}

function finishAgentTurn(
    input: {
        id: string;
        metadata: Record<string, unknown>;
        now?: string;
        status: Extract<AgentTurnStatus, 'cancelled' | 'completed' | 'failed'>;
    },
    db: Database
) {
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_turns
         SET status = $status,
             metadata_json = $metadataJson,
             updated_at = $now,
             completed_at = COALESCE(completed_at, $now)
         WHERE id = $id`
    ).run(
        namedParams({
            id: input.id,
            metadataJson: JSON.stringify(input.metadata),
            now,
            status: input.status,
        })
    );
    return getAgentTurnOrThrow(input.id, db);
}

function mergeTurnMetadata(
    turn: AgentTurn,
    patch: Record<string, unknown>,
    now: string | undefined,
    db: Database
) {
    db.prepare(
        `UPDATE agent_turns
         SET metadata_json = $metadataJson,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            id: turn.id,
            metadataJson: JSON.stringify({ ...turn.metadata, ...patch }),
            now: now ?? new Date().toISOString(),
        })
    );
}

function rowToAgentTurn(row: AgentTurnRow): AgentTurn {
    return {
        agentId: row.agent_id,
        agentSessionId: row.agent_session_id,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        id: row.id,
        kind: row.kind,
        metadata: parseRecord(row.metadata_json),
        startedAt: row.started_at,
        status: row.status,
        updatedAt: row.updated_at,
    };
}

function parseRecord(value: string) {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
}
