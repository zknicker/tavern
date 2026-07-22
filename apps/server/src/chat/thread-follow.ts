import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import type { ApiContext } from '../api/context.ts';
import { emitChatLogUpdated, emitChatUpdated } from '../api/invalidation-events.ts';
import { resolveActingUserId } from '../identity/acting-user.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export async function setTavernThreadFollow(
    input: { follow: boolean; threadChatId: string },
    ctx: Pick<ApiContext, 'clerkSessionToken'> = { clerkSessionToken: null }
) {
    const actingUserId = await resolveActingUserId(ctx);
    const connection = await getActiveAgentRuntimeConnection();
    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Grotto Runtime is not configured.');
    }

    const client = createTavernClientForConnection(connection);
    const thread = await client.chat.get(input.threadChatId, { readerId: actingUserId });
    if (thread.kind !== 'thread' || !thread.parent_chat_id) {
        throw new Error(`Chat "${input.threadChatId}" is not a thread.`);
    }

    const result = await client.chat.setThreadFollow(input.threadChatId, {
        follow: input.follow,
        participant_id: actingUserId,
    });
    emitChatUpdated({ chatId: thread.parent_chat_id });
    emitChatLogUpdated({ chatId: thread.parent_chat_id });

    return {
        followed: result.followed,
        threadChatId: input.threadChatId,
    };
}
