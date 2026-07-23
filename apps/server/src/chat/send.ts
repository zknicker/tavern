import { randomUUID } from 'node:crypto';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import type { ApiContext } from '../api/context.ts';
import {
    emitChatLogUpdated,
    emitChatUpdated,
    emitTasksUpdated,
} from '../api/invalidation-events.ts';
import { resolveActingUserId } from '../identity/acting-user.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    type SendChatMessageInput,
    sendChatMessageInputSchema,
    sendChatMessageResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

// Sends create the durable message only. Agent delivery is planner-owned
// (I1): the Runtime's inbox delivery queues the message per attention rules
// and wakes agents itself — the server never dispatches per-agent turns.
export async function sendTavernChatMessage(
    input: SendChatMessageInput,
    ctx: Pick<ApiContext, 'clerkSessionToken'> = { clerkSessionToken: null }
) {
    const parsed = sendChatMessageInputSchema.parse(input);
    const actingUserId = await resolveActingUserId(ctx);
    const chatRecord = await getRuntimeChatRecord(parsed.chatId, {
        actingUserId,
        readerId: actingUserId,
    });

    if (!chatRecord) {
        throw new Error(`No Grotto chat named "${parsed.chatId}" exists.`);
    }

    const chat = chatRecord.chat;
    const clientMessageId = parsed.clientMessageId ?? `msg_${randomUUID()}`;
    const tavernApi = await createTavernApiClient(chatRecord.runtimeId);
    await tavernApi.chat.create({
        id: parsed.chatId,
        metadata: chat.metadata,
        title:
            typeof chat.metadata.tavern === 'object' &&
            chat.metadata.tavern !== null &&
            typeof (chat.metadata.tavern as Record<string, unknown>).displayName === 'string'
                ? ((chat.metadata.tavern as Record<string, unknown>).displayName as string)
                : undefined,
    });
    const threadChat = parsed.thread
        ? await tavernApi.chat.ensureThread(parsed.chatId, {
              anchor_message_id: parsed.thread.anchorMessageId,
          })
        : null;
    const writeChatId = threadChat?.id ?? parsed.chatId;
    const messageReceipt = await tavernApi.chat.createMessage(writeChatId, {
        author_id: actingUserId,
        id: clientMessageId,
        metadata: {
            runtime: {
                runtimeId: chatRecord.runtimeId,
                source: 'tavern',
            },
        },
        ...(parsed.attachments?.length ? { attachments: parsed.attachments } : {}),
        content: parsed.content,
        nonce: clientMessageId,
        role: 'user',
    });
    if (parsed.asTask && !threadChat && (chat.scope === 'channel' || chat.scope === 'dm')) {
        await tavernApi.request(
            `/api/messages/${encodeURIComponent(messageReceipt.message.id)}/task`,
            {
                body: { origin: 'composed' },
                method: 'POST',
            }
        );
        emitTasksUpdated();
    }
    if (threadChat) {
        // Human thread replies never project a runtime message event (no turn
        // metadata), so the server emits the refresh itself: thread log,
        // parent log (reply pill), and chat list (unread rollup).
        emitChatLogUpdated({ chatId: threadChat.id });
        emitChatLogUpdated({ chatId: parsed.chatId });
        emitChatUpdated({ chatId: parsed.chatId });
    }

    return sendChatMessageResultSchema.parse({
        acceptedAt: messageReceipt.message.created_at,
        chatId: parsed.chatId,
        clientMessageId,
        status: 'accepted',
        threadChatId: threadChat?.id ?? null,
    });
}

async function createTavernApiClient(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Grotto Runtime connection "${runtimeId}" is not configured.`);
    }

    return createTavernClientForConnection(connection);
}
