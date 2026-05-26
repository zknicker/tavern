import { chatLogPageSchema } from './contracts.ts';
import { listRuntimeChatTimeline } from './runtime-chat-api.ts';

export async function getChatLogPage(input: { id: string; limit: number; offset?: number }) {
    const timeline = await listRuntimeChatTimeline(input.id);

    if (timeline === null) {
        return chatLogPageSchema.parse({
            activeReply: null,
            limit: input.limit,
            rows: [],
            offset: 0,
            total: 0,
        });
    }
    const { activeReply, rows } = timeline;
    const total = rows.length;
    const offset =
        typeof input.offset === 'number'
            ? Math.min(input.offset, total)
            : Math.max(total - input.limit, 0);

    return chatLogPageSchema.parse({
        activeReply,
        limit: input.limit,
        rows: rows.slice(offset, offset + input.limit),
        offset,
        total,
    });
}
