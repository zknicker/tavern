import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { emitChatLogUpdated, emitChatUpdated } from '../api/invalidation-events.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

/**
 * Dismissing a timeline row soft-deletes its response in Tavern Runtime: the
 * row (a failed turn) disappears from the timeline on every client but stays
 * durable.
 */
export async function dismissChatResponse(input: { chatId: string; responseId: string }) {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Grotto Runtime is not connected.');
    }

    const client = createTavernClientForConnection(connection);
    const receipt = await client.chat.deleteResponse(input.responseId);
    emitChatUpdated({ chatId: input.chatId });
    emitChatLogUpdated();

    return { dismissedAt: receipt.deleted_at, responseId: receipt.response_id };
}

/**
 * Clearing a chat soft-deletes every message and response in Tavern Runtime:
 * the timeline empties on every client while the rows stay durable.
 */
export async function clearTavernChat(chatId: string) {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Grotto Runtime is not connected.');
    }

    const client = createTavernClientForConnection(connection);
    const receipt = await client.chat.clear(chatId);
    emitChatUpdated({ chatId });
    emitChatLogUpdated();

    return {
        chatId: receipt.chat_id,
        clearedAt: receipt.cleared_at,
        messagesDeleted: receipt.messages_deleted,
        responsesDeleted: receipt.responses_deleted,
    };
}
