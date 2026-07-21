import type { AppRouterOutputs } from '../../../lib/trpc.tsx';
import { buildChatList } from '../../chats/chat-list-data.ts';

type AgentChats = AppRouterOutputs['agent']['chats']['list'];
type AgentChat = ReturnType<typeof buildChatList>[number];

export function listAgentChats(chats: AgentChats | null | undefined) {
    return buildChatList(chats);
}

export function selectMostRecentAgentChat(
    chats: AgentChats | null | undefined,
    conversationKind?: AgentChat['conversationKind']
) {
    return (
        listAgentChats(chats)
            .filter((chat) => !conversationKind || chat.conversationKind === conversationKind)
            .sort((left, right) => chatTimestamp(right) - chatTimestamp(left))[0] ?? null
    );
}

function chatTimestamp(chat: AgentChat) {
    return Date.parse(chat.lastActivityAt ?? chat.createdAt ?? '') || 0;
}
