import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatListItem } from '../chats/chat-list-data.ts';

export function formatSidebarActivityLabel(label: string) {
    if (label.endsWith(' ago')) {
        return label.slice(0, -4);
    }

    return label;
}

export function buildSidebarChatList(chats: ChatListItem[]) {
    return chats.filter(isSidebarTavernChat);
}

export function buildSidebarChatGroups(chats: ChatListItem[]) {
    const allChats = buildSidebarChatList(chats);

    return {
        allChats,
        channels: allChats.filter((chat) => chat.conversationKind === 'channel'),
        directMessages: allChats.filter((chat) => chat.conversationKind === 'direct'),
        recentChats: allChats,
        taskChats: allChats.filter((chat) => chat.conversationKind === 'task'),
    };
}

export function isSidebarTavernChat(
    chat: Pick<ChatListItem, 'framework' | 'type'>
): chat is ChatListItem {
    return chat.framework === 'tavern' && chat.type === 'tavern';
}

export function getSidebarChatTitle(chat: ChatListItem) {
    return resolveTavernChatName(chat);
}

export function hasLocalActiveTurn(state: Pick<ChatTimelineState, 'activeTurns'>) {
    return state.activeTurns.length > 0;
}
