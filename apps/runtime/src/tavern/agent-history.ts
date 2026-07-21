import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError, targetNotFound } from './agent-api-errors.ts';
import { senderIdForHandle, toAgentMessage } from './agent-messages.ts';
import { readCurrentAgentSession } from './agent-session-store.ts';
import { resolveAgentTarget } from './agent-targets.ts';
import { isAgentChatParticipant } from './chat-actions-tools.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat, resolveMessageId } from './chat-api/index.ts';
import { searchMessageRows } from './chat-api/message-search.ts';
import { rowToMessage } from './chat-api/messages.ts';
import type { MessageRow } from './chat-api/types.ts';
import { readSeenCursor } from './seen-ledger.ts';
import { advanceServedCursor } from './served-ledger.ts';

export function readAgentHistory(
    agentId: string,
    input: {
        after?: string | null;
        around?: string | null;
        before?: string | null;
        limit?: number;
        target: string;
    },
    db: Database = getDb()
) {
    const target = resolveAgentTarget({ agentId, target: input.target }, db);
    const limit = clamp(input.limit, 50, 100);
    const anchors = [input.before, input.after, input.around].filter(Boolean);
    if (anchors.length > 1) {
        throw new AgentApiError('INVALID_ARG', 'Use only one history anchor.', 400);
    }
    const before = input.before ? resolveAnchor(target.chat.id, input.before, db) : null;
    const after = input.after ? resolveAnchor(target.chat.id, input.after, db) : null;
    const around = input.around ? resolveAnchor(target.chat.id, input.around, db) : null;
    const bounds = around
        ? {
              after: Math.max(0, around - Math.ceil(limit / 2) - 1),
              before: around + Math.floor(limit / 2) + 1,
          }
        : { after: after ?? 0, before };
    const rows = db
        .prepare(
            `SELECT * FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence > $after
               AND ($before IS NULL OR sequence < $before)
             ORDER BY sequence ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                after: bounds.after,
                before: bounds.before,
                chatId: target.chat.id,
                limit,
            })
        ) as MessageRow[];
    const messages = rows.map((row) => rowToMessage(row, db));
    const newestServed = messages.at(-1)?.sequence;
    if (newestServed) {
        advanceServedCursor({ agentId, chatId: target.chat.id, seq: newestServed }, db);
    }
    const olderThan =
        messages[0]?.sequence ?? bounds.before ?? target.chat.last_message_sequence + 1;
    const newerThan = messages.at(-1)?.sequence ?? bounds.after;
    const hasOlder = hasMessageOutside(target.chat.id, 'older', olderThan, db);
    const hasNewer = hasMessageOutside(target.chat.id, 'newer', newerThan, db);
    const session = readCurrentAgentSession({ agentId, db });
    const seen = session ? readSeenCursor(session.id, target.chat.id, db) : 0;
    return {
        has_more: hasOlder || hasNewer,
        has_newer: hasNewer,
        has_older: hasOlder,
        last_read: { after: seen, unread_after: seen },
        messages: messages.map((message) => toAgentMessage(message, db)),
        target: target.target,
    };
}

export function getAgentMessage(agentId: string, id: string, db: Database = getDb()) {
    const message = resolveMessageId(id, {}, db);
    if (!message) {
        throw new AgentApiError('RESOLVE_FAILED', `Message ${id} was not found.`, 404);
    }
    const chat = getChatForMembership(message.chat_id, agentId, db);
    if (!chat) {
        throw new AgentApiError('NOT_A_MEMBER', 'Message is not in a joined chat.', 403);
    }
    return { message: toAgentMessage(message, db) };
}

export function searchAgentMessages(
    agentId: string,
    input: {
        after?: string | null;
        before?: string | null;
        limit?: number;
        offset?: number;
        q: string;
        sender?: string | null;
        sort?: string | null;
        target?: string | null;
    },
    db: Database = getDb()
) {
    const query = input.q.trim();
    if (!query) {
        throw new AgentApiError('INVALID_ARG', 'Search query is required.', 400);
    }
    const chatId = input.target
        ? resolveAgentTarget({ agentId, target: input.target }, db).chat.id
        : null;
    const senderHandle = input.sender?.replace(/^@/u, '') ?? null;
    validateDateParam(input.before, 'before');
    validateDateParam(input.after, 'after');
    const senderId = senderHandle ? senderIdForHandle(senderHandle, db) : null;
    if (senderHandle && !senderId) {
        throw targetNotFound(`Sender @${senderHandle} was not found.`);
    }
    const sort = input.sort ?? 'relevance';
    if (sort !== 'recent' && sort !== 'relevance') {
        throw new AgentApiError('INVALID_ARG', 'sort must be relevance or recent.', 400);
    }
    const rows = searchMessageRows(
        {
            after: input.after,
            before: input.before,
            chatId,
            limit: clamp(input.limit, 20, 100),
            offset: input.offset,
            participantId: createAgentParticipantId(agentId),
            query,
            senderId,
            sort,
        },
        db
    );
    return { messages: rows.map((row) => toAgentMessage(rowToMessage(row, db), db)) };
}

function resolveAnchor(chatId: string, anchor: string, db: Database): number {
    if (/^[1-9]\d*$/u.test(anchor)) {
        return Number(anchor);
    }
    const message = resolveMessageId(anchor, { chatId }, db);
    if (!message) {
        throw new AgentApiError('RESOLVE_FAILED', `Anchor ${anchor} was not found.`, 404);
    }
    return message.sequence;
}

function getChatForMembership(chatId: string, agentId: string, db: Database) {
    const chat = getChat(chatId, db);
    return chat && isAgentChatParticipant(chat, agentId, createAgentParticipantId(agentId))
        ? chat
        : null;
}

function hasMessageOutside(
    chatId: string,
    direction: 'newer' | 'older',
    sequence: number,
    db: Database
) {
    const operator = direction === 'older' ? '<' : '>';
    return Boolean(
        db
            .prepare(
                `SELECT 1 FROM chat_messages
                 WHERE chat_id = $chatId AND sequence ${operator} $sequence
                 LIMIT 1`
            )
            .get(namedParams({ chatId, sequence }))
    );
}

function validateDateParam(value: string | null | undefined, name: string): void {
    if (value && !Number.isFinite(Date.parse(value))) {
        throw new AgentApiError('INVALID_ARG', `${name} must be an ISO timestamp.`, 400);
    }
}

function clamp(value: number | undefined, fallback: number, max: number) {
    return Math.min(max, Math.max(1, Math.floor(value ?? fallback)));
}
