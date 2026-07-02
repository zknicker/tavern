import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useChatList } from '../../../hooks/chats/use-chat-list.ts';
import { buildChatList, type ChatListItem } from '../../chats/chat-list-data.ts';
import { describeRoute, type RouteDescriptor } from './describe-route.tsx';

// The current route resolved against the synced chat list — what the shell
// toolbar (breadcrumb, participants slot) keys its presentation off.
export function useActiveChat(): { chat: ChatListItem | undefined; descriptor: RouteDescriptor } {
    const location = useLocation();
    const chatQuery = useChatList();
    const chatById = React.useMemo(
        () => new Map(buildChatList(chatQuery.data).map((chat) => [chat.id, chat])),
        [chatQuery.data]
    );
    const descriptor = describeRoute(location.pathname, chatById);

    return {
        chat: descriptor.chatId ? chatById.get(descriptor.chatId) : undefined,
        descriptor,
    };
}
