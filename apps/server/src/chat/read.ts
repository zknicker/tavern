import { z } from 'zod';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import type { ApiContext } from '../api/context.ts';
import { resolveActingUserId } from '../identity/acting-user.ts';
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
export async function markTavernChatRead(
    input: { chatId: string },
    ctx: Pick<ApiContext, 'clerkSessionToken'> = { clerkSessionToken: null }
) {
    const actingUserId = await resolveActingUserId(ctx);
    const chatRecord = await getRuntimeChatRecord(input.chatId, {
        actingUserId,
        readerId: actingUserId,
    });

    if (!chatRecord) {
        throw new Error(`No Tavern chat named "${input.chatId}" exists.`);
    }

    const connection = await getAgentRuntimeConnection(chatRecord.runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Tavern Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    const receipt = await createTavernClientForConnection(connection).chat.markRead(input.chatId, {
        reader_id: actingUserId,
    });

    return {
        chatId: input.chatId,
        lastReadSequence: receipt.last_read_sequence,
    };
}
