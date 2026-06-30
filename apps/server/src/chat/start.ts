import {
    type StartChatInput,
    sendChatMessageResultSchema,
    startChatInputSchema,
} from './contracts.ts';
import { createTavernChat } from './save.ts';
import { sendTavernChatMessage } from './send.ts';

const maxChatDisplayNameLength = 70;

function buildChatDisplayName(input: StartChatInput) {
    const fallback = input.attachments?.[0]
        ? `Attachment: ${input.attachments[0].filename}`
        : 'New chat';
    const normalized = (input.content || fallback).replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxChatDisplayNameLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxChatDisplayNameLength - 3).trimEnd()}...`;
}

export async function startTavernChat(input: StartChatInput) {
    const parsed = startChatInputSchema.parse(input);
    const metadata = mergeStartChatAddressing(parsed);
    const created = await createTavernChat({
        agentIds: parsed.agentId ? [parsed.agentId] : undefined,
        displayName: buildChatDisplayName(parsed),
        displayNameSource: 'generated',
    });
    const accepted = await sendTavernChatMessage({
        agentId: parsed.agentId,
        ...(parsed.attachments?.length ? { attachments: parsed.attachments } : {}),
        chatId: created.chatId,
        ...(parsed.clientMessageId ? { clientMessageId: parsed.clientMessageId } : {}),
        content: parsed.content,
        ...(metadata ? { metadata } : {}),
        ...(parsed.modelRef ? { modelRef: parsed.modelRef } : {}),
    });

    return sendChatMessageResultSchema.parse(accepted);
}

function mergeStartChatAddressing(input: StartChatInput) {
    if (!input.agentId) {
        return input.metadata;
    }

    const existing = input.metadata;
    const addressedAgentIds = new Set(existing?.tavern?.addressedAgentIds ?? []);
    addressedAgentIds.add(input.agentId);

    return {
        ...(existing ?? {}),
        tavern: {
            ...(existing?.tavern ?? {}),
            addressedAgentIds: [...addressedAgentIds],
        },
    };
}
