import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

export function readServedCursor(agentId: string, chatId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT served_up_to_seq
             FROM agent_served_chat_cursors
             WHERE agent_id = $agentId AND chat_id = $chatId`
        )
        .get(namedParams({ agentId, chatId })) as { served_up_to_seq: number } | null;
    return row?.served_up_to_seq ?? 0;
}

/** Monotonic. Pull responses and hold displays are the only callers. */
export function advanceServedCursor(
    input: { agentId: string; chatId: string; now?: string; seq: number },
    db: Database = getDb()
) {
    if (!(Number.isFinite(input.seq) && input.seq > 0)) {
        return;
    }
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `INSERT INTO agent_served_chat_cursors
         (agent_id, chat_id, served_up_to_seq, updated_at)
         VALUES ($agentId, $chatId, $seq, $now)
         ON CONFLICT(agent_id, chat_id) DO UPDATE SET
           served_up_to_seq = MAX(served_up_to_seq, excluded.served_up_to_seq),
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: input.agentId,
            chatId: input.chatId,
            now,
            seq: Math.floor(input.seq),
        })
    );
}
