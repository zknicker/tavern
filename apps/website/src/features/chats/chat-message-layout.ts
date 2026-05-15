import type { ConversationMessageLayout } from './chat-transcript-model.ts';

interface ChatMessageLayoutInput {
    boundAgentIds: string[];
    participants: Array<{
        actorId: string;
        actorType: 'agent' | 'participant';
    }>;
}

export function getChatMessageLayout(chat: ChatMessageLayoutInput) {
    const agentIds = new Set(chat.boundAgentIds);
    const humanIds = new Set<string>();

    for (const participant of chat.participants) {
        if (participant.actorType === 'agent') {
            agentIds.add(participant.actorId);
            continue;
        }

        humanIds.add(participant.actorId);
    }

    const humanCount = Math.max(humanIds.size, 1);

    return {
        showAgentIdentity: agentIds.size > 1,
        showHumanIdentity: humanCount > 1,
    } satisfies ConversationMessageLayout;
}
