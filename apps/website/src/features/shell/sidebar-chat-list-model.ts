import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import type { ChatListItem } from '../chats/chat-list-data.ts';
import { buildChatPath, buildNewChatDraftPath } from '../chats/chat-path.ts';

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
        channels: allChats.filter((chat) => !chat.isPinned && chat.conversationKind === 'channel'),
        directMessages: allChats.filter(
            (chat) => !chat.isPinned && chat.conversationKind === 'direct'
        ),
        pinnedChats: allChats.filter((chat) => chat.isPinned),
        recentChats: allChats.filter((chat) => !chat.isPinned),
    };
}

export function buildSidebarDraftChatList(drafts: ChatStartDraft[], chats: ChatListItem[]) {
    const syncedChatIds = new Set(chats.map((chat) => chat.id));

    return drafts
        .filter((draft) => !(draft.realChatId && syncedChatIds.has(draft.realChatId)))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function getSidebarDraftPath(draft: ChatStartDraft) {
    return draft.realChatId ? buildChatPath(draft.realChatId) : buildNewChatDraftPath();
}

export function getSidebarDraftActivityLabel(draft: Pick<ChatStartDraft, 'status'>) {
    if (draft.status === 'error') {
        return 'failed';
    }

    if (draft.status === 'queued' || draft.status === 'creating') {
        return 'starting';
    }

    return 'just now';
}

export function isSidebarTavernChat(
    chat: Pick<ChatListItem, 'framework' | 'type'>
): chat is ChatListItem {
    return chat.framework === 'tavern' && chat.type === 'tavern';
}

export function getSidebarChatTitle(chat: ChatListItem) {
    return resolveTavernChatName(chat);
}

export function hasLocalActiveTurn(state: Pick<ChatTimelineState, 'activeTurn'>) {
    return state.activeTurn !== null;
}
