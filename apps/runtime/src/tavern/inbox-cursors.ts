import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

// Two-cursor inbox ledger (I3, specs/raft-alignment/README.md): per
// (session, target) `delivered` is transport state — what the inbox has
// queued for the agent — and `seen` is the sole model-seen authority for
// freshness holds and catch-up. `seen` advances only on proof: envelopes
// embedded in a delivered prompt advance it when the turn settles; CLI pull
// outputs advance it when the tool result commits back into the session
// stream; hold catch-up rows advance it when shown. Notices and wakes
// advance nothing, ever. A turn that pulled and died re-delivers from
// `seen` — duplicate envelopes after crashes are by design.

export interface InboxCursor {
    deliveredUpToSeq: number;
    seenUpToSeq: number;
}

export function readInboxCursor(
    sessionId: string,
    chatId: string,
    db: Database = getDb()
): InboxCursor {
    const row = db
        .prepare(
            `SELECT delivered_up_to_seq, seen_up_to_seq
             FROM agent_inbox_cursors
             WHERE session_id = $sessionId AND chat_id = $chatId
             LIMIT 1`
        )
        .get(namedParams({ chatId, sessionId })) as {
        delivered_up_to_seq: number;
        seen_up_to_seq: number;
    } | null;
    return {
        deliveredUpToSeq: row?.delivered_up_to_seq ?? 0,
        seenUpToSeq: row?.seen_up_to_seq ?? 0,
    };
}

export function readSeenCursor(sessionId: string, chatId: string, db: Database = getDb()) {
    return readInboxCursor(sessionId, chatId, db).seenUpToSeq;
}

/** Monotonic: never moves a cursor backwards. */
export function advanceDeliveredCursor(
    input: { chatId: string; now?: string; seq: number; sessionId: string },
    db: Database = getDb()
) {
    advanceCursorColumn('delivered_up_to_seq', input, db);
}

/** Monotonic: never moves a cursor backwards. */
export function advanceSeenCursor(
    input: { chatId: string; now?: string; seq: number; sessionId: string },
    db: Database = getDb()
) {
    advanceCursorColumn('seen_up_to_seq', input, db);
}

/** Every cursor row for a session — dev-mode inbox diagnostics (I4). */
export function listInboxCursors(sessionId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT chat_id, delivered_up_to_seq, seen_up_to_seq
             FROM agent_inbox_cursors
             WHERE session_id = $sessionId
             ORDER BY chat_id ASC`
        )
        .all(namedParams({ sessionId })) as Array<{
        chat_id: string;
        delivered_up_to_seq: number;
        seen_up_to_seq: number;
    }>;
    return rows.map((row) => ({
        chatId: row.chat_id,
        deliveredUpToSeq: row.delivered_up_to_seq,
        seenUpToSeq: row.seen_up_to_seq,
    }));
}

/** Targets with queued-but-unseen rows, for drains and `inbox check`. */
export function listPendingInboxTargets(sessionId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT chat_id, delivered_up_to_seq, seen_up_to_seq
             FROM agent_inbox_cursors
             WHERE session_id = $sessionId
               AND delivered_up_to_seq > seen_up_to_seq
             ORDER BY chat_id ASC`
        )
        .all(namedParams({ sessionId })) as Array<{
        chat_id: string;
        delivered_up_to_seq: number;
        seen_up_to_seq: number;
    }>;
    return rows.map((row) => ({
        chatId: row.chat_id,
        deliveredUpToSeq: row.delivered_up_to_seq,
        seenUpToSeq: row.seen_up_to_seq,
    }));
}

export function recordInboxPierce(
    input: { chatId: string; messageId: string; now?: string; sessionId: string },
    db: Database = getDb()
) {
    db.prepare(
        `INSERT OR IGNORE INTO agent_inbox_pierces (session_id, chat_id, message_id, created_at)
         VALUES ($sessionId, $chatId, $messageId, $now)`
    ).run(
        namedParams({
            chatId: input.chatId,
            messageId: input.messageId,
            now: input.now ?? new Date().toISOString(),
            sessionId: input.sessionId,
        })
    );
}

export function listInboxPierces(
    sessionId: string,
    input: { excludeServed?: boolean } = {},
    db: Database = getDb()
) {
    const rows = db
        .prepare(
            `SELECT chat_id, message_id
             FROM agent_inbox_pierces
             WHERE session_id = $sessionId
               AND ($excludeServed = 0 OR served_run_id IS NULL)
             ORDER BY created_at ASC, message_id ASC`
        )
        .all(namedParams({ excludeServed: input.excludeServed ? 1 : 0, sessionId })) as Array<{
        chat_id: string;
        message_id: string;
    }>;
    return rows.map((row) => ({ chatId: row.chat_id, messageId: row.message_id }));
}

export function markInboxPiercesServed(
    input: { messageIds: string[]; runId: string; sessionId: string },
    db: Database = getDb()
) {
    const mark = db.prepare(
        `UPDATE agent_inbox_pierces
         SET served_run_id = $runId
         WHERE session_id = $sessionId
           AND message_id = $messageId
           AND served_run_id IS NULL`
    );
    for (const messageId of input.messageIds) {
        mark.run(namedParams({ messageId, runId: input.runId, sessionId: input.sessionId }));
    }
}

export function resetInboxPiercesForRun(input: { runId: string }, db: Database = getDb()) {
    db.prepare(
        `UPDATE agent_inbox_pierces
         SET served_run_id = NULL
         WHERE served_run_id = $runId`
    ).run(namedParams(input));
}

export function clearInboxPiercesForRun(input: { runId: string }, db: Database = getDb()) {
    db.prepare(
        `DELETE FROM agent_inbox_pierces
         WHERE served_run_id = $runId`
    ).run(namedParams(input));
}

export function clearInboxPierces(
    input: { messageIds: string[]; sessionId: string },
    db: Database = getDb()
) {
    const remove = db.prepare(
        `DELETE FROM agent_inbox_pierces
         WHERE session_id = $sessionId AND message_id = $messageId`
    );
    for (const messageId of input.messageIds) {
        remove.run(namedParams({ messageId, sessionId: input.sessionId }));
    }
}

function advanceCursorColumn(
    column: 'delivered_up_to_seq' | 'seen_up_to_seq',
    input: { chatId: string; now?: string; seq: number; sessionId: string },
    db: Database
) {
    if (!(Number.isFinite(input.seq) && input.seq > 0)) {
        return;
    }
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `INSERT INTO agent_inbox_cursors (session_id, chat_id, ${column}, updated_at)
         VALUES ($sessionId, $chatId, $seq, $now)
         ON CONFLICT(session_id, chat_id) DO UPDATE SET
             ${column} = MAX(${column}, excluded.${column}),
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
