import type { TavernChatMessage } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { formatAgentTarget } from './agent-targets.ts';
import { getChat, latestMessageSequence } from './chat-api/index.ts';
import { rowToMessage } from './chat-api/messages.ts';
import type { MessageRow } from './chat-api/types.ts';
import { advanceSeenCursor, readSeenCursor } from './seen-ledger.ts';
import { advanceServedCursor, readServedCursor } from './served-ledger.ts';

export const maxHoldContextMessages = 12;
export const maxRecentUnreadMessages = 10;

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
        readServedCursor(input.sessionId, input.chatId, db)
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
    advanceServedCursor(
        { chatId: input.chatId, seq: shownThrough, sessionId: input.sessionId },
        db
    );
    return {
        newMessageCount: count,
        omittedMessageCount: Math.max(0, count - messages.length),
        shownMessages: messages,
    };
}

export interface RecentUnreadRow {
    message: TavernChatMessage;
    target: string;
}

/**
 * Unseen peer rows across the caller's other targets, shown on a fresh send.
 * Shown rows advance both cursors — same rule as hold catch-up.
 */
export function collectRecentUnread(
    input: {
        agentId: string;
        excludeChatId: string;
        participantId: string;
        sessionId: string;
    },
    db: Database = getDb()
): RecentUnreadRow[] {
    const chatIds = db
        .prepare(
            `SELECT DISTINCT chats.id
             FROM chats
             JOIN chat_participants ON chat_participants.chat_id = chats.id
             WHERE chat_participants.id = $participantId
               AND chats.id != $excludeChatId
               AND chats.kind IN ('channel', 'dm')`
        )
        .all(
            namedParams({ excludeChatId: input.excludeChatId, participantId: input.participantId })
        )
        .map((row) => (row as { id: string }).id);
    const collected: RecentUnreadRow[] = [];
    for (const chatId of chatIds) {
        const chat = getChat(chatId, db);
        if (!chat) {
            continue;
        }
        const target = formatAgentTarget(input.agentId, chat, db);
        if (!target) {
            continue;
        }
        const horizon = Math.max(
            readSeenCursor(input.sessionId, chatId, db),
            readServedCursor(input.sessionId, chatId, db)
        );
        if (latestMessageSequence(chatId, db) <= horizon) {
            continue;
        }
        const { messages } = listUnseenPeerMessages(
            {
                afterSequence: horizon,
                agentId: input.agentId,
                chatId,
                participantId: input.participantId,
            },
            db
        );
        collected.push(...messages.map((message) => ({ message, target })));
    }
    const shown = collected
        .sort((a, b) => a.message.created_at.localeCompare(b.message.created_at))
        .slice(-maxRecentUnreadMessages);
    const shownThroughByChat = new Map<string, number>();
    for (const row of shown) {
        const previous = shownThroughByChat.get(row.message.chat_id) ?? 0;
        shownThroughByChat.set(row.message.chat_id, Math.max(previous, row.message.sequence));
    }
    for (const [chatId, seq] of shownThroughByChat) {
        advanceSeenCursor({ chatId, seq, sessionId: input.sessionId }, db);
        advanceServedCursor({ chatId, seq, sessionId: input.sessionId }, db);
    }
    return shown;
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
