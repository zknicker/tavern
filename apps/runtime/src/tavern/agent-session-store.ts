import {
    type AgentRuntimeAgentSession,
    type AgentRuntimeModelName,
    agentRuntimeAgentSessionSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { resolveAgentModelSelection } from '../models/selection-service';
import type { ParticipantRow } from './chat-api/types';

interface AgentSessionRow {
    agent_id: string;
    agent_participant_id: string;
    archived_at: null | string;
    chat_id: string;
    created_at: string;
    effective_model_json: string;
    generation: number;
    id: string;
    instructions_hash: null | string;
    prompt_context_sequence: number;
    resume_state_json: null | string;
    runtime_session_id: null | string;
    status: AgentRuntimeAgentSession['status'];
    updated_at: string;
}

interface AgentSeat extends ParticipantRow {
    agentId: string;
}

export function ensureCurrentAgentSession(input: {
    agentParticipantId?: string;
    chatId: string;
    db?: Database;
    now?: string;
}) {
    const db = input.db ?? getDb();
    const seat = resolveAgentSeat({
        agentParticipantId: input.agentParticipantId,
        chatId: input.chatId,
        db,
    });
    const now = input.now ?? new Date().toISOString();
    const current = seat.current_agent_session_id
        ? readAgentSession(seat.current_agent_session_id, db)
        : null;

    if (isCurrentForSeat(current, seat)) {
        archiveOtherActiveSessions({ db, now, seat, sessionId: current.id });
        return current;
    }

    const latestActive = readLatestActiveAgentSession(seat, db);
    if (latestActive) {
        db.prepare(
            `UPDATE chat_participants
             SET current_agent_session_id = $sessionId
             WHERE chat_id = $chatId AND id = $agentParticipantId`
        ).run(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
                sessionId: latestActive.id,
            })
        );
        archiveOtherActiveSessions({ db, now, seat, sessionId: latestActive.id });
        return latestActive;
    }

    return startNewAgentSession({
        agentParticipantId: seat.id,
        chatId: seat.chat_id,
        db,
        now,
    });
}

export function startNewAgentSession(input: {
    agentParticipantId?: string;
    chatId: string;
    db?: Database;
    effectiveModel?: AgentRuntimeModelName;
    now?: string;
    promptContextSequence?: number;
    resumeState?: Record<string, unknown> | null;
    runtimeSessionId?: string | null;
}) {
    const db = input.db ?? getDb();
    const seat = resolveAgentSeat({
        agentParticipantId: input.agentParticipantId,
        chatId: input.chatId,
        db,
    });
    const now = input.now ?? new Date().toISOString();
    const generation = nextGeneration(seat, db);
    const id = createAgentSessionId({
        agentParticipantId: seat.id,
        chatId: seat.chat_id,
        generation,
    });
    const effectiveModel =
        input.effectiveModel ?? resolveAgentModelSelection({ agentId: seat.agentId, db });

    const transaction = db.transaction(() => {
        db.prepare(
            `UPDATE agent_sessions
             SET status = 'archived',
                 archived_at = COALESCE(archived_at, $now),
                 updated_at = $now
             WHERE chat_id = $chatId
               AND agent_participant_id = $agentParticipantId
               AND status = 'active'`
        ).run(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
                now,
            })
        );

        db.prepare(
            `INSERT INTO agent_sessions (
                id,
                chat_id,
                agent_participant_id,
                agent_id,
                generation,
                effective_model_json,
                runtime_session_id,
                resume_state_json,
                prompt_context_sequence,
                status,
                created_at,
                updated_at,
                archived_at
             )
             VALUES (
                $id,
                $chatId,
                $agentParticipantId,
                $agentId,
                $generation,
                $effectiveModelJson,
                $runtimeSessionId,
                $resumeStateJson,
                $promptContextSequence,
                'active',
                $now,
                $now,
                NULL
             )`
        ).run(
            namedParams({
                agentId: seat.agentId,
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
                effectiveModelJson: JSON.stringify(effectiveModel),
                generation,
                id,
                now,
                promptContextSequence: input.promptContextSequence ?? 0,
                resumeStateJson:
                    input.resumeState === undefined || input.resumeState === null
                        ? null
                        : JSON.stringify(input.resumeState),
                runtimeSessionId: input.runtimeSessionId ?? null,
            })
        );

        db.prepare(
            `UPDATE chat_participants
             SET current_agent_session_id = $sessionId
             WHERE chat_id = $chatId AND id = $agentParticipantId`
        ).run(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
                sessionId: id,
            })
        );
    });
    transaction();

    const session = readAgentSession(id, db);
    if (!session) {
        throw new Error(`Agent session ${id} was not persisted.`);
    }
    return session;
}

export function readCurrentAgentSession(input: {
    agentParticipantId?: string;
    chatId: string;
    db?: Database;
}) {
    const db = input.db ?? getDb();
    const seat = resolveAgentSeat({
        agentParticipantId: input.agentParticipantId,
        chatId: input.chatId,
        db,
    });
    if (!seat.current_agent_session_id) {
        return null;
    }
    const session = readAgentSession(seat.current_agent_session_id, db);
    return isCurrentForSeat(session, seat) ? session : null;
}

export function listAgentSessionsForSeat(input: {
    agentParticipantId?: string;
    chatId: string;
    db?: Database;
}) {
    const db = input.db ?? getDb();
    const seat = resolveAgentSeat({
        agentParticipantId: input.agentParticipantId,
        chatId: input.chatId,
        db,
    });
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_sessions
             WHERE chat_id = $chatId AND agent_participant_id = $agentParticipantId
             ORDER BY generation ASC`
        )
        .all(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
            })
        ) as AgentSessionRow[];
    return rows.map(rowToAgentSession);
}

/**
 * Records the fingerprint of the instructions actually delivered to the
 * executor session. Written on non-resume turns only — harness adapters
 * drop instructions on resumed turns, so the delivered set is fixed at
 * session start.
 */
export function recordAgentSessionInstructionsHash(input: {
    db?: Database;
    hash: string;
    id: string;
    now?: string;
}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_sessions
         SET instructions_hash = $hash,
             updated_at = $now
         WHERE id = $id`
    ).run(namedParams({ hash: input.hash, id: input.id, now }));
}

export function readAgentSessionInstructionsHash(id: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT instructions_hash FROM agent_sessions WHERE id = $id LIMIT 1')
        .get(namedParams({ id })) as { instructions_hash: null | string } | null;
    return row?.instructions_hash ?? null;
}
export function updateAgentSessionRuntimeState(input: {
    db?: Database;
    id: string;
    now?: string;
    promptContextSequence?: number | null;
    resumeState?: Record<string, unknown> | null;
    runtimeSessionId?: string | null;
}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_sessions
         SET runtime_session_id = $runtimeSessionId,
             resume_state_json = $resumeStateJson,
             prompt_context_sequence = CASE
                 WHEN $promptContextSequence IS NULL THEN prompt_context_sequence
                 WHEN $promptContextSequence > prompt_context_sequence THEN $promptContextSequence
                 ELSE prompt_context_sequence
             END,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            id: input.id,
            now,
            promptContextSequence: input.promptContextSequence ?? null,
            resumeStateJson:
                input.resumeState === undefined || input.resumeState === null
                    ? null
                    : JSON.stringify(input.resumeState),
            runtimeSessionId: input.runtimeSessionId ?? null,
        })
    );

    return readAgentSession(input.id, db);
}

function resolveAgentSeat(input: {
    agentParticipantId?: string;
    chatId: string;
    db: Database;
}): AgentSeat {
    const rows = input.agentParticipantId
        ? ([
              input.db
                  .prepare(
                      `SELECT *
                       FROM chat_participants
                       WHERE chat_id = $chatId AND id = $agentParticipantId AND kind = 'agent'
                       LIMIT 1`
                  )
                  .get(
                      namedParams({
                          agentParticipantId: input.agentParticipantId,
                          chatId: input.chatId,
                      })
                  ),
          ].filter(Boolean) as ParticipantRow[])
        : (input.db
              .prepare(
                  `SELECT *
                   FROM chat_participants
                   WHERE chat_id = $chatId AND kind = 'agent'
                   ORDER BY id ASC`
              )
              .all(namedParams({ chatId: input.chatId })) as ParticipantRow[]);

    if (rows.length === 0) {
        throw new Error(`Chat ${input.chatId} does not have an agent seat.`);
    }
    if (rows.length > 1) {
        throw new Error(`Chat ${input.chatId} has multiple agent seats; specify one.`);
    }

    const row = rows[0];
    return {
        ...row,
        agentId: extractAgentId(row),
    };
}

export function readAgentSession(
    id: string,
    db: Database = getDb()
): AgentRuntimeAgentSession | null {
    const row = db
        .prepare('SELECT * FROM agent_sessions WHERE id = $id LIMIT 1')
        .get(namedParams({ id })) as AgentSessionRow | null;
    return row ? rowToAgentSession(row) : null;
}

function readLatestActiveAgentSession(seat: AgentSeat, db: Database) {
    const row = db
        .prepare(
            `SELECT *
             FROM agent_sessions
             WHERE chat_id = $chatId
               AND agent_participant_id = $agentParticipantId
               AND status = 'active'
             ORDER BY generation DESC
             LIMIT 1`
        )
        .get(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
            })
        ) as AgentSessionRow | null;
    return row ? rowToAgentSession(row) : null;
}

function archiveOtherActiveSessions(input: {
    db: Database;
    now: string;
    seat: AgentSeat;
    sessionId: string;
}) {
    input.db
        .prepare(
            `UPDATE agent_sessions
             SET status = 'archived',
                 archived_at = COALESCE(archived_at, $now),
                 updated_at = $now
             WHERE chat_id = $chatId
               AND agent_participant_id = $agentParticipantId
               AND status = 'active'
               AND id != $sessionId`
        )
        .run(
            namedParams({
                agentParticipantId: input.seat.id,
                chatId: input.seat.chat_id,
                now: input.now,
                sessionId: input.sessionId,
            })
        );
}

function nextGeneration(seat: AgentSeat, db: Database) {
    const row = db
        .prepare(
            `SELECT MAX(generation) AS generation
             FROM agent_sessions
             WHERE chat_id = $chatId AND agent_participant_id = $agentParticipantId`
        )
        .get(
            namedParams({
                agentParticipantId: seat.id,
                chatId: seat.chat_id,
            })
        ) as { generation: null | number };
    return (row.generation ?? 0) + 1;
}

function isCurrentForSeat(
    session: AgentRuntimeAgentSession | null,
    seat: AgentSeat
): session is AgentRuntimeAgentSession {
    return (
        session?.status === 'active' &&
        session.chatId === seat.chat_id &&
        session.agentParticipantId === seat.id
    );
}

function rowToAgentSession(row: AgentSessionRow): AgentRuntimeAgentSession {
    return agentRuntimeAgentSessionSchema.parse({
        agentId: row.agent_id,
        agentParticipantId: row.agent_participant_id,
        archivedAt: row.archived_at,
        chatId: row.chat_id,
        createdAt: row.created_at,
        effectiveModel: JSON.parse(row.effective_model_json) as unknown,
        generation: row.generation,
        id: row.id,
        promptContextSequence: row.prompt_context_sequence,
        resumeState: row.resume_state_json
            ? (JSON.parse(row.resume_state_json) as Record<string, unknown>)
            : null,
        runtimeSessionId: row.runtime_session_id,
        status: row.status,
        updatedAt: row.updated_at,
    });
}

function extractAgentId(row: ParticipantRow) {
    try {
        const metadata = JSON.parse(row.metadata_json) as { agentId?: unknown };
        if (typeof metadata.agentId === 'string' && metadata.agentId.trim()) {
            return metadata.agentId;
        }
    } catch {
        // Participant ids are already Tavern-owned fallback agent ids.
    }
    return row.id;
}

function createAgentSessionId(input: {
    agentParticipantId: string;
    chatId: string;
    generation: number;
}) {
    return `ags_${slugId(input.chatId)}_${slugId(input.agentParticipantId)}_${input.generation}`;
}

function slugId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
