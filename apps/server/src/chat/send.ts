import { randomUUID } from 'node:crypto';
import type { AgentRuntimeCreateMessage } from '@tavern/api';
import { createTavernClient } from '@tavern/sdk';
import { withCapabilityStatus } from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { getChatRecord, parseChatRawJson } from '../storage/chats.ts';
import {
    type SendChatMessageInput,
    sendChatMessageInputSchema,
    sendChatMessageResultSchema,
} from './contracts.ts';
import { requireStoredTavernSessionKey } from './session-keys.ts';

function buildAgentRuntimeMessageTarget(
    chat: ReturnType<typeof parseChatRawJson>,
    sessionKey: string
): AgentRuntimeCreateMessage['target'] {
    return {
        externalId: chat.target ? chat.target.split(':').slice(1).join(':') || null : null,
        sessionKey,
        target: chat.target ?? chat.id,
        type: chat.platform,
    };
}

export async function sendTavernChatMessage(
    input: SendChatMessageInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = sendChatMessageInputSchema.parse(input);
    const chatRecord = await getChatRecord(parsed.chatId);
    const chat = chatRecord ? parseChatRawJson(chatRecord) : null;

    if (!chat) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    if (chat.bindings.length !== 1) {
        throw new Error(`Tavern chat "${parsed.chatId}" must have exactly one bound agent.`);
    }

    const [binding] = chat.bindings;
    const agentId = parsed.agentId ?? binding.agentId;
    const agentRecord = await getAgentRecord(agentId);

    if (agentRecord && agentRecord.runtimeId !== chatRecord.runtimeId) {
        throw new Error(
            `Agent "${agentId}" is not part of chat runtime "${chatRecord.runtimeId}".`
        );
    }

    const runtimeClient =
        client === undefined
            ? await createConfiguredAgentRuntimeClientForRuntimeId(chatRecord.runtimeId)
            : client;

    if (!runtimeClient) {
        throw new Error(`Tavern Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    if (binding.agentId !== agentId) {
        throw new Error(`Agent "${agentId}" is not bound to chat "${parsed.chatId}".`);
    }

    const sessionKey = requireStoredTavernSessionKey(chat, agentId);

    const clientMessageId = parsed.clientMessageId ?? `msg_${randomUUID()}`;
    const tavernApi = await createTavernApiClient(chatRecord.runtimeId);
    await tavernApi.chat.create({
        id: parsed.chatId,
        metadata: {
            runtime: {
                runtimeId: chatRecord.runtimeId,
            },
        },
    });
    const messageReceipt = await tavernApi.chat.createMessage(parsed.chatId, {
        author_id: 'usr_tavern',
        id: clientMessageId,
        metadata: {
            ...(parsed.metadata ?? {}),
            runtime: {
                agentId,
                runtimeId: chatRecord.runtimeId,
                sessionKey,
                source: 'openclaw',
            },
        },
        content: parsed.content,
        nonce: clientMessageId,
        role: 'user',
    });
    const accepted = await withCapabilityStatus(
        {
            capability: 'messages',
            method: 'messages.create',
            runtimeId: chatRecord.runtimeId,
        },
        async () =>
            await runtimeClient.postMessage(chatRecord.id, {
                agent: {
                    agentId,
                },
                message: {
                    content: parsed.content,
                    id: clientMessageId,
                    ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
                    nonce: clientMessageId,
                },
                target: buildAgentRuntimeMessageTarget(chat, sessionKey),
            })
    );
    const acceptedSessionKey = accepted.sessionKey ?? sessionKey;

    return sendChatMessageResultSchema.parse({
        acceptedAt: accepted.acceptedAt ?? messageReceipt.message.created_at,
        chatId: parsed.chatId,
        clientMessageId,
        runId: accepted.runId,
        sessionKey: acceptedSessionKey,
        status: accepted.status,
    });
}

async function createTavernApiClient(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Tavern Runtime connection "${runtimeId}" is not configured.`);
    }

    return createTavernClient({ baseUrl: connection.baseUrl });
}
