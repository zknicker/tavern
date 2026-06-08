import { chatLogPageSchema } from './contracts.ts';
import { listRuntimeChatTimeline } from './runtime-chat-api.ts';

type ChatLogCursor = number | { offset: number };

export async function getChatLogPage(input: {
    cursor?: ChatLogCursor;
    direction?: 'backward' | 'forward';
    id: string;
    limit: number;
    offset?: number;
}) {
    const timeline = await listRuntimeChatTimeline(input.id);

    if (timeline === null) {
        return chatLogPageSchema.parse({
            activeReply: null,
            failedTurn: null,
            limit: input.limit,
            rows: [],
            offset: 0,
            total: 0,
        });
    }
    const { activeReply, failedTurn, rows } = timeline;
    const total = rows.length;
    const offset = resolveChatLogOffset({
        cursor: input.cursor,
        direction: input.direction,
        limit: input.limit,
        offset: input.offset,
        total,
    });

    return chatLogPageSchema.parse({
        activeReply,
        failedTurn,
        limit: input.limit,
        rows: rows.slice(offset, offset + input.limit),
        offset,
        total,
    });
}

export function resolveChatLogOffset(input: {
    cursor?: ChatLogCursor;
    direction?: 'backward' | 'forward';
    limit: number;
    offset?: number;
    total: number;
}) {
    const cursorOffset = getCursorOffset(input.cursor);

    if (typeof cursorOffset === 'number') {
        return Math.min(cursorOffset, input.total);
    }

    if (input.direction === 'backward') {
        return 0;
    }

    if (typeof input.offset === 'number') {
        return Math.min(input.offset, input.total);
    }

    return Math.max(input.total - input.limit, 0);
}

function getCursorOffset(cursor: ChatLogCursor | undefined) {
    if (typeof cursor === 'number') {
        return cursor;
    }

    return cursor?.offset;
}
