import type { TavernChat } from '@tavern/api';

export function isAgentChatParticipant(chat: TavernChat, agentId: string, participantId: string) {
    return chat.participants.some((participant) => {
        if (participant.kind !== 'agent') {
            return false;
        }
        const metadataAgentId = (participant.metadata as Record<string, unknown>).agentId;
        return (
            participant.id === participantId ||
            (typeof metadataAgentId === 'string' && metadataAgentId === agentId)
        );
    });
}

export function isArchivedChat(chat: TavernChat) {
    const tavern = (chat.metadata as Record<string, unknown>).tavern;
    if (!tavern || typeof tavern !== 'object' || Array.isArray(tavern)) {
        return false;
    }
    return (tavern as Record<string, unknown>).archived === true;
}
