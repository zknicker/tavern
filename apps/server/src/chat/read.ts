import { z } from 'zod';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

export const markChatReadInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

/**
 * Marks the operator's read receipt at the chat's newest message. The
 * runtime resolves the latest sequence at write time, so a message landing
 * mid-request still counts as unread afterwards.
 */
export async function markTavernChatRead(input: { chatId: string }) {
    const chatRecord = await getRuntimeChatRecord(input.chatId);

    if (!chatRecord) {
        throw new Error(`No Tavern chat named "${input.chatId}" exists.`);
    }

    const connection = await getAgentRuntimeConnection(chatRecord.runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Tavern Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    const receipt = await createTavernClientForConnection(connection).chat.markRead(input.chatId, {
        reader_id: 'usr_tavern',
    });

    return {
        chatId: input.chatId,
        lastReadSequence: receipt.last_read_sequence,
    };
}
