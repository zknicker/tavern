import type { TavernChatMessage } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getChat, latestMessageSequence } from './chat-api/index.ts';
import { rowToMessage } from './chat-api/messages.ts';
import type { MessageRow } from './chat-api/types.ts';
import { advanceSeenCursor, readSeenCursor } from './seen-ledger.ts';
import { advanceServedCursor, readServedCursor } from './served-ledger.ts';

export const maxHoldContextMessages = 12;

export interface SendHoldDecision {
    newMessageCount: number;
    omittedMessageCount: number;
    shownMessages: TavernChatMessage[];
}

export function resolveSendHold(
    input: {
        agentId: string;
        chatId: string;
        participantId: string;
        seenHorizon?: number;
        sessionId: string;
    },
    db: Database = getDb()
): SendHoldDecision | null {
    if (getChat(input.chatId, db)?.kind !== 'channel') {
        return null;
    }
    const horizon = Math.max(
        input.seenHorizon ?? 0,
        readSeenCursor(input.sessionId, input.chatId, db),
        readServedCursor(input.agentId, input.chatId, db)
    );
    const latest = latestMessageSequence(input.chatId, db);
    if (latest <= horizon) {
        return null;
    }
    const { count, messages } = listUnseenPeerMessages(
        {
            afterSequence: horizon,
            agentId: input.agentId,
            chatId: input.chatId,
            participantId: input.participantId,
        },
        db
    );
    if (messages.length === 0) {
        advanceSeenCursor({ chatId: input.chatId, seq: latest, sessionId: input.sessionId }, db);
        return null;
    }
    const shownThrough = messages.at(-1)?.sequence ?? 0;
    advanceSeenCursor({ chatId: input.chatId, seq: shownThrough, sessionId: input.sessionId }, db);
    advanceServedCursor({ agentId: input.agentId, chatId: input.chatId, seq: shownThrough }, db);
    return {
        newMessageCount: count,
        omittedMessageCount: Math.max(0, count - messages.length),
        shownMessages: messages,
    };
}

function listUnseenPeerMessages(
    input: {
        afterSequence: number;
        agentId: string;
        chatId: string;
        participantId: string;
    },
    db: Database
) {
    const where = `chat_id = $chatId
      AND sequence > $afterSequence
      AND deleted_at IS NULL
      AND role IN ('assistant', 'user')
      AND author_id != $participantId
      AND author_id != $agentId`;
    const params = namedParams(input);
    const countRow = db
        .prepare(`SELECT COUNT(*) AS count FROM chat_messages WHERE ${where}`)
        .get(params) as { count: number };
    const rows = db
        .prepare(
            `SELECT * FROM chat_messages
             WHERE ${where}
             ORDER BY sequence DESC
             LIMIT $limit`
        )
        .all({ ...params, $limit: maxHoldContextMessages }) as MessageRow[];
    return {
        count: countRow.count,
        messages: rows.reverse().map((row) => rowToMessage(row, db)),
    };
}
