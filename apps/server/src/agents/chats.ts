import { chatListSchema } from '../chat/contracts.ts';
import { listChatDetails } from '../chat/list.ts';

export async function listAgentChats(input: { agentId: string }) {
    const chats = await listChatDetails({ includeExternal: true });
    const agentChats = chats.filter((chat) => chat.boundAgentIds.includes(input.agentId));
    const itemsById = Object.fromEntries(
        agentChats.map((chat) => [
            chat.id,
            {
                agentRuntimeSync: chat.agentRuntimeSync,
                boundAgentIds: chat.boundAgentIds,
                canSend: chat.canSend,
                conversationKind: chat.conversationKind,
                displayName: chat.displayName,
                framework: chat.framework,
                hasActiveTurn: chat.hasActiveTurn,
                id: chat.id,
                isEnabled: chat.isEnabled,
                isPinned: chat.isPinned,
                lastActivityAt: chat.lastActivityAt,
                latestSession: chat.latestSession,
                participants: chat.participants,
                scope: chat.scope,
                sessionCount: chat.sessionCount,
                source: chat.source,
                targetParticipant: chat.targetParticipant,
                title: chat.title,
                type: chat.type,
            },
        ])
    );

    return chatListSchema.parse({
        ids: agentChats.map((chat) => chat.id),
        itemsById,
    });
}
