import type { AppRouterOutputs } from '../../../lib/trpc.tsx';
import { buildChatList } from '../../chats/chat-list-data.ts';
import { isSidebarTavernChat } from '../../shell/sidebar-chat-list-model.ts';

type AgentChats = AppRouterOutputs['agent']['chats']['list'];
type AgentChat = ReturnType<typeof buildChatList>[number];

// Only Tavern chats are navigable via /chats/:id (chat.get excludes
// external runtime chats), so the profile lists and routes only those.
export function listAgentChats(chats: AgentChats | null | undefined) {
    return buildChatList(chats).filter(isSidebarTavernChat);
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

// The session is agent-global, so any associated chat can address it. Unlike
// profile chat links, this includes archived Tavern and external runtime chats.
export function selectMostRecentAgentSessionChat(chats: AgentChats | null | undefined) {
    return (
        [...buildChatList(chats)].sort(
            (left, right) => chatTimestamp(right) - chatTimestamp(left)
        )[0] ?? null
    );
}

function chatTimestamp(chat: AgentChat) {
    return Date.parse(chat.lastActivityAt ?? chat.createdAt ?? '') || 0;
}
