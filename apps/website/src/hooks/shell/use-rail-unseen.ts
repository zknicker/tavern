import * as React from 'react';
import { buildChatList } from '../../features/chats/chat-list-data.ts';
import { isSidebarTavernChat } from '../../features/shell/sidebar-chat-list-model.ts';
import { useChatList } from '../chats/use-chat-list.ts';

export function useActivityUnseen() {
    const chatsQuery = useChatList();

    return React.useMemo(
        () =>
            buildChatList(chatsQuery.data).some(
                (chat) => isSidebarTavernChat(chat) && chat.unreadCount > 0
            ),
        [chatsQuery.data]
    );
}
