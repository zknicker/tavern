import { randomUUID } from 'node:crypto';
import type { AgentRuntimeCreateMessage } from '@tavern/api';
import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api/rich-references';
import {
    requireRuntimeCapabilityHealthy,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import type { ApiContext } from '../api/context.ts';
import { resolveActingUserId } from '../identity/acting-user.ts';
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
    client?: TavernAgentRuntimeClient | null,
    ctx: Pick<ApiContext, 'clerkSessionToken'> = { clerkSessionToken: null }
) {
    const parsed = sendChatMessageInputSchema.parse(input);
    const actingUserId = await resolveActingUserId(ctx);
    const chatRecord = await getRuntimeChatRecord(parsed.chatId, {
        actingUserId,
        readerId: actingUserId,
    });

    if (!chatRecord) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    const chat = chatRecord.chat;

    const targetAgentIds = resolveTargetAgentIds({
        chat,
        content: parsed.content,
        requestedAgentId: parsed.agentId,
    });
    await assertAgentsBelongToRuntime({
        agentIds: targetAgentIds,
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
        author_id: actingUserId,
        id: clientMessageId,
        metadata: {
            runtime: {
                runtimeId: chatRecord.runtimeId,
                source: targetAgentIds.length > 0 ? 'agent-engine' : 'tavern',
            },
        },
        ...(parsed.attachments?.length ? { attachments: parsed.attachments } : {}),
        content: parsed.content,
        nonce: clientMessageId,
        role: 'user',
    });

    if (targetAgentIds.length === 0) {
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
        targetAgentIds.map((agentId) =>
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

export function resolveTargetAgentIds(input: {
    chat: NonNullable<Awaited<ReturnType<typeof getRuntimeChatRecord>>>['chat'];
    content: string;
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

    if (input.chat.scope === 'task') {
        if (!input.requestedAgentId) {
            throw new Error(`Task chat "${input.chat.id}" requires an agent target.`);
        }
        if (!chatAgentIds.has(input.requestedAgentId)) {
            throw new Error(
                `Agent "${input.requestedAgentId}" is not part of chat "${input.chat.id}".`
            );
        }
        return [input.requestedAgentId];
    }

    const generatedAgentChatIds = [...chatAgentIds];
    if (isGeneratedTavernAgentChat(input.chat.metadata) && generatedAgentChatIds.length === 1) {
        return generatedAgentChatIds;
    }

    const mentionedAgentIds = readMentionedAgentIds(input.content);
    for (const agentId of mentionedAgentIds) {
        if (!chatAgentIds.has(agentId)) {
            throw new Error(`Agent "${agentId}" is not part of chat "${input.chat.id}".`);
        }
    }

    // Default-evaluate addressing (specs/addressing.md): every agent seat
    // evaluates every channel message; mentions set who is expected to
    // answer, never who gets a turn.
    return [...chatAgentIds];
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

function readMentionedAgentIds(content: string) {
    return [
        ...new Set(
            parseTavernRichReferences(content).flatMap((reference) => {
                if (reference.kind !== 'agent') {
                    return [];
                }

                const agentId = parseAgentReferenceTarget(reference.id);
                return agentId ? [agentId] : [];
            })
        ),
    ];
}

async function createTavernApiClient(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error(`Tavern Runtime connection "${runtimeId}" is not configured.`);
    }

    return createTavernClientForConnection(connection);
}
