import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { emitChatLogUpdated, emitChatUpdated } from '../api/invalidation-events.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

/**
 * Dismissing a timeline row soft-deletes its response in Tavern Runtime: the
 * row (command card, failed turn) disappears from the timeline on every
 * client but stays durable. See specs/composer-commands.md.
 */
export async function dismissChatResponse(input: { chatId: string; responseId: string }) {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Tavern Runtime is not connected.');
    }

    const client = createTavernClientForConnection(connection);
    const receipt = await client.chat.deleteResponse(input.responseId);
    emitChatUpdated({ chatId: input.chatId });
    emitChatLogUpdated();

    return { dismissedAt: receipt.deleted_at, responseId: receipt.response_id };
}
