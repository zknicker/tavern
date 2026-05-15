import { randomUUID } from 'node:crypto';
import type { AgentRuntimeCreateMessage } from '@tavern/agent-runtime-protocol';
import { withCapabilityStatus } from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import { getAgent as getAgentProjection } from '../storage/agents.ts';
import { getChatProjection, parseChatRawJson } from '../storage/chats.ts';
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
    const chatProjection = await getChatProjection(parsed.chatId);
    const chat = chatProjection ? parseChatRawJson(chatProjection) : null;

    if (!chat) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    if (chat.bindings.length !== 1) {
        throw new Error(`Tavern chat "${parsed.chatId}" must have exactly one bound agent.`);
    }

    const [binding] = chat.bindings;
    const agentId = parsed.agentId ?? binding.agentId;
    const agentProjection = await getAgentProjection(agentId);

    if (agentProjection && agentProjection.runtimeId !== chatProjection.runtimeId) {
        throw new Error(
            `Agent "${agentId}" is not part of chat runtime "${chatProjection.runtimeId}".`
        );
    }

    const runtimeClient =
        client === undefined
            ? await createConfiguredAgentRuntimeClientForRuntimeId(chatProjection.runtimeId)
            : client;

    if (!runtimeClient) {
        throw new Error(
            `Tavern Runtime connection "${chatProjection.runtimeId}" is not configured.`
        );
    }

    if (binding.agentId !== agentId) {
        throw new Error(`Agent "${agentId}" is not bound to chat "${parsed.chatId}".`);
    }

    const sessionKey = requireStoredTavernSessionKey(chat, agentId);

    const clientMessageId = parsed.clientMessageId ?? `tavern-message:${randomUUID()}`;
    const accepted = await withCapabilityStatus(
        {
            capability: 'messages',
            method: 'messages.create',
            runtimeId: chatProjection.runtimeId,
        },
        async () =>
            await runtimeClient.postMessage(chatProjection.id, {
                agent: {
                    agentId,
                },
                message: {
                    content: parsed.content,
                    id: clientMessageId,
                    ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
                },
                target: buildAgentRuntimeMessageTarget(chat, sessionKey),
            })
    );

    return sendChatMessageResultSchema.parse({
        acceptedAt: accepted.acceptedAt,
        chatId: parsed.chatId,
        clientMessageId,
        runId: accepted.runId,
        sessionKey: accepted.sessionKey,
        status: accepted.status,
    });
}
