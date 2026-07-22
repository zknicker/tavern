import { matchPath } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { appRoutes } from '../../lib/app-routes.ts';
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

export function selectMostRecentChatRailConversation(chats: ChatListItem[]) {
    return [...chats]
        .filter((chat) => chat.conversationKind === 'channel' || chat.conversationKind === 'direct')
        .sort((left, right) => chatTimestamp(right) - chatTimestamp(left))[0];
}

export function resolveNavigableActivityChatId(chatId: null | string, chats: ChatListItem[]) {
    return chatId && chats.some((chat) => chat.id === chatId) ? chatId : null;
}

export function resolveCurrentChatId(pathname: string) {
    if (pathname === appRoutes.archivedChats) {
        return null;
    }

    return (
        matchPath({ end: true, path: appRoutes.chat(':chatId') }, pathname)?.params.chatId ?? null
    );
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

function chatTimestamp(chat: Pick<ChatListItem, 'createdAt' | 'lastActivityAt'>) {
    return Date.parse(chat.lastActivityAt ?? chat.createdAt ?? '') || 0;
}
