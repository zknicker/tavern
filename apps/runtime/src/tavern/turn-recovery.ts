import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { failAgentTurn } from './agent-turn-store';
import { upsertResponse } from './chat-api';

const interruptedSummary = 'Interrupted by an agent runtime restart.';

interface InterruptedResponseRow {
    chat_id: string;
    id: string;
    metadata_json: null | string;
    participant_id: string;
    request_message_id: null | string;
}

interface InterruptedTurnRow {
    id: string;
}

/**
 * Finalizes chat responses orphaned in a non-terminal state by a Runtime
 * restart. The agent stream consumer lives in process memory, so a restart
 * mid-turn leaves the canonical response row running forever while the engine
 * finishes (or finished) on its own. Runs once at startup, before new turns.
 */
export function recoverInterruptedChatResponses(db: Database = getDb()): number {
    const turnRows = db
        .prepare(
            `SELECT id
             FROM agent_turns
             WHERE status IN ('queued', 'running')`
        )
        .all() as InterruptedTurnRow[];

    for (const row of turnRows) {
        failAgentTurn({ error: interruptedSummary, id: row.id }, db);
    }

    const rows = db
        .prepare(
            `SELECT id, chat_id, participant_id, request_message_id, metadata_json
             FROM chat_responses
             WHERE status IN ('queued', 'running')`
        )
        .all() as InterruptedResponseRow[];

    for (const row of rows) {
        const metadata = readMetadata(row.metadata_json);
        const runtime = isRecord(metadata.runtime) ? metadata.runtime : {};
        upsertResponse(
            row.chat_id,
            {
                id: row.id,
                metadata: {
                    ...metadata,
                    error: interruptedSummary,
                    runtime: {
                        ...runtime,
                        error: interruptedSummary,
                        errorCode: 'control_plane_restarted',
                    },
                },
                participant_id: row.participant_id,
                request_message_id: row.request_message_id,
                status: 'failed',
                summary: interruptedSummary,
            },
            db
        );
    }

    return rows.length + turnRows.length;
}

function readMetadata(value: null | string): Record<string, unknown> {
    if (!value) {
        return {};
    }
    try {
        const parsed = JSON.parse(value) as unknown;
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
