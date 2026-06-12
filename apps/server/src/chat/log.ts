import { chatLogPageSchema } from './contracts.ts';
import { getRuntimeChatTimelinePage } from './runtime-chat-api.ts';

type ChatLogCursor = number | { beforeSequence: number };

export async function getChatLogPage(input: {
    cursor?: ChatLogCursor;
    id: string;
    limit: number;
}) {
    const beforeSequence = resolveBeforeSequence(input.cursor);
    const page = await getRuntimeChatTimelinePage(input.id, {
        beforeSequence,
        limit: input.limit,
    });

    if (page === null) {
        return chatLogPageSchema.parse({
            activeReply: null,
            failedTurn: null,
            limit: input.limit,
            nextBeforeSequence: null,
            rows: [],
            totalMessages: 0,
        });
    }

    return chatLogPageSchema.parse({
        activeReply: page.activeReply,
        failedTurn: page.failedTurn,
        limit: input.limit,
        nextBeforeSequence: page.nextBeforeSequence,
        rows: page.rows,
        totalMessages: page.totalMessages,
    });
}

export function resolveBeforeSequence(cursor: ChatLogCursor | undefined) {
    if (typeof cursor === 'number') {
        return cursor;
    }

    return cursor?.beforeSequence;
}
