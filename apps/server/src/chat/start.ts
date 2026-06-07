import {
    type StartChatInput,
    sendChatMessageResultSchema,
    startChatInputSchema,
} from './contracts.ts';
import { createTavernChat } from './save.ts';
import { sendTavernChatMessage } from './send.ts';

const maxChatDisplayNameLength = 70;

function buildChatDisplayName(content: string) {
    const normalized = content.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxChatDisplayNameLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxChatDisplayNameLength - 3).trimEnd()}...`;
}

export async function startTavernChat(input: StartChatInput) {
    const parsed = startChatInputSchema.parse(input);
    const created = await createTavernChat({
        agentIds: parsed.agentId ? [parsed.agentId] : undefined,
        displayName: buildChatDisplayName(parsed.content),
        displayNameSource: 'generated',
    });
    const accepted = await sendTavernChatMessage({
        agentId: parsed.agentId,
        chatId: created.chatId,
        ...(parsed.clientMessageId ? { clientMessageId: parsed.clientMessageId } : {}),
        content: parsed.content,
        ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
    });

    return sendChatMessageResultSchema.parse(accepted);
}
