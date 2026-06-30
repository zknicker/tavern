import { randomUUID } from 'node:crypto';
import type { AgentRuntimeCreateMessage } from '@tavern/api';
import {
    requireRuntimeCapabilityHealthy,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import {
    type SendChatMessageInput,
    sendChatMessageInputSchema,
    sendChatMessageResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

function buildAgentRuntimeMessageTarget(
    chat: NonNullable<Awaited<ReturnType<typeof getRuntimeChatRecord>>>['chat']
): AgentRuntimeCreateMessage['target'] {
    return {
        externalId: chat.target ? chat.target.split(':').slice(1).join(':') || null : null,
        target: chat.target ?? chat.id,
        type: chat.platform,
    };
}

export async function sendTavernChatMessage(
    input: SendChatMessageInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = sendChatMessageInputSchema.parse(input);
    const chatRecord = await getRuntimeChatRecord(parsed.chatId);

    if (!chatRecord) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    const chat = chatRecord.chat;

    const addressedAgentIds = resolveAddressedAgentIds({
        chat,
        requestedAgentId: parsed.agentId,
        metadata: parsed.metadata,
    });
    await assertAgentsBelongToRuntime({
        agentIds: addressedAgentIds,
        runtimeId: chatRecord.runtimeId,
    });

    const runtimeClient =
        client === undefined
            ? await createConfiguredAgentRuntimeClientForRuntimeId(chatRecord.runtimeId)
            : client;

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
    const messageReceipt = await tavernApi.chat.createMessage(parsed.chatId, {
        author_id: 'usr_tavern',
        id: clientMessageId,
        metadata: {
            ...(parsed.metadata ?? {}),
            runtime: {
                ...(parsed.modelRef ? { modelRef: parsed.modelRef } : {}),
                runtimeId: chatRecord.runtimeId,
                source: addressedAgentIds.length > 0 ? 'agent-engine' : 'tavern',
            },
        },
        ...(parsed.attachments?.length ? { attachments: parsed.attachments } : {}),
        content: parsed.content,
        nonce: clientMessageId,
        role: 'user',
    });

    if (addressedAgentIds.length === 0) {
        return sendChatMessageResultSchema.parse({
            acceptedAt: messageReceipt.message.created_at,
            chatId: parsed.chatId,
            clientMessageId,
            status: 'accepted',
            turns: [],
        });
    }

    if (!runtimeClient) {
        throw new Error(`Tavern Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    await requireRuntimeCapabilityHealthy({
        capability: 'gateway',
        client: runtimeClient,
        runtimeId: chatRecord.runtimeId,
    });

    const acceptedTurns = await Promise.all(
        addressedAgentIds.map((agentId) =>
            withCapabilityStatus(
                {
                    capability: 'gateway',
                    method: 'gateway.prompt.submit',
                    runtimeId: chatRecord.runtimeId,
                },
                async () =>
                    await runtimeClient.postMessage(chatRecord.chat.id, {
                        agent: {
                            agentId,
                        },
                        message: {
                            ...(parsed.attachments?.length
                                ? { attachments: parsed.attachments }
                                : {}),
                            content: parsed.content,
                            id: clientMessageId,
                            ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
                            ...(parsed.modelRef ? { modelRef: parsed.modelRef } : {}),
                            nonce: clientMessageId,
                        },
                        target: buildAgentRuntimeMessageTarget(chat),
                    })
            ).then((accepted) => ({
                agentId,
                runId: accepted.runId,
            }))
        )
    );

    return sendChatMessageResultSchema.parse({
        acceptedAt: messageReceipt.message.created_at,
        chatId: parsed.chatId,
        clientMessageId,
        status: 'accepted',
        turns: acceptedTurns,
    });
}

function resolveAddressedAgentIds(input: {
    chat: NonNullable<Awaited<ReturnType<typeof getRuntimeChatRecord>>>['chat'];
    metadata: SendChatMessageInput['metadata'];
    requestedAgentId?: string;
}) {
    const chatAgentIds = new Set(input.chat.bindings.map((binding) => binding.agentId));

    if (input.chat.scope === 'dm') {
        const dmAgentIds = [...chatAgentIds];
        if (dmAgentIds.length !== 1) {
            throw new Error(`Agent DM "${input.chat.id}" must have exactly one agent participant.`);
        }
        const [agentId] = dmAgentIds;
        if (input.requestedAgentId && input.requestedAgentId !== agentId) {
            throw new Error(
                `Agent "${input.requestedAgentId}" is not part of chat "${input.chat.id}".`
            );
        }
        return [agentId];
    }

    const generatedAgentChatIds = [...chatAgentIds];
    if (isGeneratedTavernAgentChat(input.chat.metadata) && generatedAgentChatIds.length === 1) {
        return generatedAgentChatIds;
    }

    const mentionedAgentIds = readMentionedAgentIds(input.metadata);
    for (const agentId of mentionedAgentIds) {
        if (!chatAgentIds.has(agentId)) {
            throw new Error(`Agent "${agentId}" is not part of chat "${input.chat.id}".`);
        }
    }

    return mentionedAgentIds;
}

function isGeneratedTavernAgentChat(metadata: Record<string, unknown>) {
    const tavern = metadata.tavern;
    return (
        typeof tavern === 'object' &&
        tavern !== null &&
        (tavern as Record<string, unknown>).displayNameSource === 'generated'
    );
}

async function assertAgentsBelongToRuntime(input: { agentIds: string[]; runtimeId: string }) {
    for (const agentId of input.agentIds) {
        const agentRecord = await getAgentRecord(agentId);
        if (agentRecord && agentRecord.runtimeId !== input.runtimeId) {
            throw new Error(`Agent "${agentId}" is not part of chat runtime "${input.runtimeId}".`);
        }
    }
}

function readMentionedAgentIds(metadata: SendChatMessageInput['metadata']) {
    const addressedAgentIds = metadata?.tavern?.addressedAgentIds ?? [];
    const mentions = metadata?.tavern?.mentions ?? [];
    const mentionedAgentIds = mentions
        .filter((mention) => mention.kind === 'agent')
        .map((mention) => mention.id);

    return [...new Set([...addressedAgentIds, ...mentionedAgentIds])];
}

async function createTavernApiClient(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Tavern Runtime connection "${runtimeId}" is not configured.`);
    }

    return createTavernClientForConnection(connection);
}
