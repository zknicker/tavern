import { listAgentRuntimeChatRows } from './agent-runtime-log.ts';
import { chatLogPageSchema } from './contracts.ts';

export async function getChatLogPage(input: { id: string; limit: number; offset?: number }) {
    const rows = await listAgentRuntimeChatRows(input.id);

    if (rows === null) {
        return chatLogPageSchema.parse({
            limit: input.limit,
            rows: [],
            offset: 0,
            total: 0,
        });
    }
    const total = rows.length;
    const offset =
        typeof input.offset === 'number'
            ? Math.min(input.offset, total)
            : Math.max(total - input.limit, 0);

    return chatLogPageSchema.parse({
        limit: input.limit,
        rows: rows.slice(offset, offset + input.limit),
        offset,
        total,
    });
}
