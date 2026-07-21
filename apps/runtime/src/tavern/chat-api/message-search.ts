import { getDb } from '../../db/connection.ts';
import type { Database } from '../../db/sqlite.ts';
import { namedParams } from '../../db/sqlite.ts';
import { clampLimit } from './limits.ts';
import type { MessageRow } from './types.ts';

export function searchMessageRows(
    input: {
        after?: string | null;
        before?: string | null;
        chatId?: string | null;
        limit?: number;
        offset?: number;
        participantId?: string | null;
        query: string;
        senderId?: string | null;
        sort?: 'recent' | 'relevance' | 'sequence';
    },
    db: Database = getDb()
): MessageRow[] {
    const query = input.query.trim();
    if (!query) {
        throw new Error('Message search query is required.');
    }
    const orderBy = searchOrder(input.sort ?? 'sequence');
    return db
        .prepare(
            `SELECT chat_messages.* FROM chat_messages
             WHERE instr(lower(chat_messages.content), lower($query)) > 0
               AND ($chatId IS NULL OR chat_messages.chat_id = $chatId)
               AND ($senderId IS NULL OR chat_messages.author_id = $senderId)
               AND ($before IS NULL OR chat_messages.created_at < $before)
               AND ($after IS NULL OR chat_messages.created_at > $after)
               AND ($participantId IS NULL OR EXISTS (
                 SELECT 1 FROM chat_participants membership
                 WHERE membership.chat_id = chat_messages.chat_id
                   AND membership.id = $participantId
                   AND membership.kind = 'agent'
               ))
             ORDER BY ${orderBy}
             LIMIT $limit OFFSET $offset`
        )
        .all(
            namedParams({
                after: input.after ?? null,
                before: input.before ?? null,
                chatId: input.chatId ?? null,
                limit: clampLimit(input.limit),
                offset: Math.max(0, Math.floor(input.offset ?? 0)),
                participantId: input.participantId ?? null,
                query,
                senderId: input.senderId ?? null,
            })
        ) as MessageRow[];
}

function searchOrder(sort: NonNullable<Parameters<typeof searchMessageRows>[0]['sort']>): string {
    if (sort === 'recent') {
        return 'chat_messages.created_at DESC, chat_messages.id DESC';
    }
    if (sort === 'relevance') {
        return 'instr(lower(chat_messages.content), lower($query)) ASC, length(chat_messages.content) ASC, chat_messages.created_at DESC';
    }
    return 'chat_messages.sequence DESC';
}
