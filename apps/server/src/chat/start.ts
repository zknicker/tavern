import type { ApiContext } from '../api/context.ts';
import { resolveActingUserId } from '../identity/acting-user.ts';
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

export async function startTavernChat(
    input: StartChatInput,
    ctx: Pick<ApiContext, 'clerkSessionToken'> = { clerkSessionToken: null }
) {
    const parsed = startChatInputSchema.parse(input);
    const actingUserId = await resolveActingUserId(ctx);
    const created = await createTavernChat(
        {
            agentIds: parsed.agentId ? [parsed.agentId] : undefined,
            displayName: buildChatDisplayName(parsed),
            displayNameSource: 'generated',
        },
        actingUserId
    );
    const accepted = await sendTavernChatMessage(
        {
            ...(parsed.attachments?.length ? { attachments: parsed.attachments } : {}),
            chatId: created.chatId,
            ...(parsed.clientMessageId ? { clientMessageId: parsed.clientMessageId } : {}),
            content: parsed.content,
        },
        ctx
    );

    return sendChatMessageResultSchema.parse(accepted);
}
