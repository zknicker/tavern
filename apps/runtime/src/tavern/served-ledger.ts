import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

// Keyed by (session, chat) like the seen ledger: a session reset starts a
// fresh served horizon, so a new session never inherits hold bypasses.

export function readServedCursor(sessionId: string, chatId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT served_up_to_seq
             FROM agent_session_served_cursors
             WHERE session_id = $sessionId AND chat_id = $chatId`
        )
        .get(namedParams({ chatId, sessionId })) as { served_up_to_seq: number } | null;
    return row?.served_up_to_seq ?? 0;
}

/** Every served cursor for a session, for the runner's settle-time proofs. */
export function listServedCursors(sessionId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT chat_id, served_up_to_seq
             FROM agent_session_served_cursors
             WHERE session_id = $sessionId`
        )
        .all(namedParams({ sessionId })) as Array<{ chat_id: string; served_up_to_seq: number }>;
    return new Map(rows.map((row) => [row.chat_id, row.served_up_to_seq]));
}

/** Monotonic. Pull responses and hold displays are the only callers. */
export function advanceServedCursor(
    input: { chatId: string; now?: string; seq: number; sessionId: string },
    db: Database = getDb()
) {
    if (!(Number.isFinite(input.seq) && input.seq > 0)) {
        return;
    }
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `INSERT INTO agent_session_served_cursors
         (session_id, chat_id, served_up_to_seq, updated_at)
         VALUES ($sessionId, $chatId, $seq, $now)
         ON CONFLICT(session_id, chat_id) DO UPDATE SET
           served_up_to_seq = MAX(served_up_to_seq, excluded.served_up_to_seq),
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            chatId: input.chatId,
            now,
            seq: Math.floor(input.seq),
            sessionId: input.sessionId,
        })
    );
}
