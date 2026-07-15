import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

// Seen ledger (specs/sessions.md): per-(session, chat) cursor of the highest
// message sequence provably model-visible. Prompt catch-up, busy deliveries,
// and hold envelopes advance it; notices never do. The ledger feeds turn
// intake (what to push) and action gating (what makes an action stale).

export function readSeenCursor(sessionId: string, chatId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT seen_up_to_seq
             FROM agent_session_chat_cursors
             WHERE session_id = $sessionId AND chat_id = $chatId
             LIMIT 1`
        )
        .get(namedParams({ chatId, sessionId })) as { seen_up_to_seq: number } | null;
    return row?.seen_up_to_seq ?? 0;
}

/** Monotonic: never moves a cursor backwards. */
export function advanceSeenCursor(
    input: { chatId: string; now?: string; seq: number; sessionId: string },
    db: Database = getDb()
) {
    if (!(Number.isFinite(input.seq) && input.seq > 0)) {
        return;
    }
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `INSERT INTO agent_session_chat_cursors (session_id, chat_id, seen_up_to_seq, updated_at)
         VALUES ($sessionId, $chatId, $seq, $now)
         ON CONFLICT(session_id, chat_id) DO UPDATE SET
             seen_up_to_seq = MAX(seen_up_to_seq, excluded.seen_up_to_seq),
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

export function readSeenCursors(sessionId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT chat_id, seen_up_to_seq
             FROM agent_session_chat_cursors
             WHERE session_id = $sessionId`
        )
        .all(namedParams({ sessionId })) as Array<{ chat_id: string; seen_up_to_seq: number }>;
    return new Map(rows.map((row) => [row.chat_id, row.seen_up_to_seq]));
}
