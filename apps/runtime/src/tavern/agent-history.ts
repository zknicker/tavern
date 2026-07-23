import type { TavernThreadSummary } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError, targetNotFound } from './agent-api-errors.ts';
import { senderIdForHandle, toAgentMessage } from './agent-messages.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import {
    formatAgentTarget,
    type ResolvedAgentTarget,
    resolveAgentTarget,
} from './agent-targets.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    anchorShortId,
    getChat,
    listReadableChatsForAgentParticipant,
    membershipChat,
    resolveMessageId,
    threadSummaries,
} from './chat-api/index.ts';
import { searchMessageRows } from './chat-api/message-search.ts';
import { rowToMessage } from './chat-api/messages.ts';
import type { MessageRow } from './chat-api/types.ts';
import { isAgentChatParticipant } from './chat-guards.ts';
import { readSeenCursor } from './inbox-cursors.ts';
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
    // Around-window: anchor always included, remaining budget split half older /
    // half newer (exclusive bounds admit exactly `limit` sequence slots).
    const olderBudget = around === null ? 0 : Math.floor((limit - 1) / 2);
    const bounds = around
        ? {
              after: Math.max(0, around - olderBudget - 1),
              before: Math.max(0, around - olderBudget - 1) + limit + 1,
          }
        : { after: after ?? 0, before };
    // No anchor (or --before only) pages from the newest row backward; --after
    // and --around scan forward from their lower bound.
    const newestFirst = !(after || around);
    const rows = db
        .prepare(
            `SELECT * FROM chat_messages
             WHERE chat_id = $chatId
               AND deleted_at IS NULL
               AND sequence > $after
               AND ($before IS NULL OR sequence < $before)
             ORDER BY sequence ${newestFirst ? 'DESC' : 'ASC'}
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
    if (newestFirst) {
        rows.reverse();
    }
    const messages = rows.map((row) => rowToMessage(row, db));
    const session = ensureCurrentAgentSession({ agentId, db });
    const newestServed = messages.at(-1)?.sequence;
    if (newestServed) {
        advanceServedCursor(
            { chatId: target.chat.id, seq: newestServed, sessionId: session.id },
            db
        );
    }
    const olderThan =
        messages[0]?.sequence ?? bounds.before ?? target.chat.last_message_sequence + 1;
    const newerThan = messages.at(-1)?.sequence ?? bounds.after;
    const hasOlder = hasMessageOutside(target.chat.id, 'older', olderThan, db);
    const hasNewer = hasMessageOutside(target.chat.id, 'newer', newerThan, db);
    const seen = readSeenCursor(session.id, target.chat.id, db);
    return {
        has_more: hasOlder || hasNewer,
        has_newer: hasNewer,
        has_older: hasOlder,
        last_read: { after: seen, unread_after: seen },
        messages: decorateThreadFields(messages, target, createAgentParticipantId(agentId), db),
        target: target.target,
    };
}

// History lines carry the thread slivers (specs/grotto-cli.md): anchors with
// an existing thread expose threadId/replyCount, and every top-level line
// gets the computed replyTarget — omitted inside threads, where replying in
// place is already threading.
function decorateThreadFields(
    messages: ReturnType<typeof rowToMessage>[],
    target: ResolvedAgentTarget,
    participantId: string,
    db: Database
) {
    const inThread = target.chat.kind === 'thread';
    const summariesByAnchor = inThread
        ? new Map<string, TavernThreadSummary>()
        : new Map(
              threadSummaries(
                  target.chat.id,
                  participantId,
                  db,
                  messages.map((message) => message.id)
              ).map((summary) => [summary.anchor_message_id, summary])
          );
    return messages.map((message) => {
        const summary = summariesByAnchor.get(message.id);
        return {
            ...toAgentMessage(message, db),
            ...(summary
                ? { replyCount: summary.reply_count, threadId: summary.thread_chat_id }
                : {}),
            ...(inThread ? {} : { replyTarget: `${target.target}:${anchorShortId(message.id)}` }),
        };
    });
}

export function getAgentMessage(agentId: string, id: string, db: Database = getDb()) {
    // Short-id resolution is scoped to the caller's READABLE chats (parent
    // seats, unfollowed threads included) before ambiguity is decided; full
    // ids resolve globally and then hit the membership check.
    const memberChatIds = listReadableChatsForAgentParticipant(
        createAgentParticipantId(agentId),
        db
    ).map((chat) => chat.id);
    const message = resolveMessageId(id, { chatIds: memberChatIds }, db);
    if (!message || message.deleted_at) {
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
    const before = normalizeDateParam(input.before, 'before');
    const after = normalizeDateParam(input.after, 'after');
    const senderId = senderHandle ? senderIdForHandle(senderHandle, db) : null;
    if (senderHandle && !senderId) {
        throw targetNotFound(`Sender @${senderHandle} was not found.`);
    }
    const sort = input.sort ?? 'relevance';
    if (sort !== 'recent' && sort !== 'relevance') {
        throw new AgentApiError('INVALID_ARG', 'sort must be relevance or recent.', 400);
    }
    const participantId = createAgentParticipantId(agentId);
    // Search spans the readable scope (unfollowed threads included) —
    // enumeration follows attention, reading follows the parent seat.
    const targets = new Map(
        listReadableChatsForAgentParticipant(participantId, db).flatMap((chat) => {
            const target = formatAgentTarget(agentId, chat, db);
            return target ? [[chat.id, target] as const] : [];
        })
    );
    const rows = searchMessageRows(
        {
            after,
            before,
            chatId,
            chatIds: [...targets.keys()],
            limit: clamp(input.limit, 20, 100),
            offset: input.offset,
            participantId,
            query,
            senderId,
            sort,
        },
        db
    );
    const messages = rows.flatMap((row) => {
        const target = targets.get(row.chat_id);
        return target ? [{ ...toAgentMessage(rowToMessage(row, db), db), target }] : [];
    });
    return { messages };
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
    // Threads never own membership: the parent seat authorizes the read.
    const seatChat = chat ? membershipChat(chat, db) : null;
    return chat &&
        seatChat &&
        isAgentChatParticipant(seatChat, agentId, createAgentParticipantId(agentId))
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
                 WHERE chat_id = $chatId
                   AND deleted_at IS NULL
                   AND sequence ${operator} $sequence
                 LIMIT 1`
            )
            .get(namedParams({ chatId, sequence }))
    );
}

// Stored created_at values are ISO strings compared lexicographically, so the
// filter must be normalized ISO too, not whatever Date.parse tolerates.
function normalizeDateParam(value: string | null | undefined, name: string): string | null {
    if (!value) {
        return null;
    }
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        throw new AgentApiError('INVALID_ARG', `${name} must be an ISO timestamp.`, 400);
    }
    return new Date(parsed).toISOString();
}

function clamp(value: number | undefined, fallback: number, max: number) {
    return Math.min(max, Math.max(1, Math.floor(value ?? fallback)));
}
