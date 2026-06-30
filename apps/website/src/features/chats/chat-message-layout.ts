import type { ConversationMessageLayout } from './chat-transcript-model.ts';

interface ChatMessageLayoutInput {
    boundAgentIds: string[];
    participants: Array<{
        actorId: string;
        actorType: 'agent' | 'participant';
    }>;
}

export function getChatMessageLayout(chat: ChatMessageLayoutInput) {
    void chat;
    return {
        showAgentIdentity: true,
        showHumanIdentity: true,
    } satisfies ConversationMessageLayout;
}
