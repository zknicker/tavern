import { Navigate } from 'react-router-dom';
import { buildChatList } from '../../features/chats/chat-list-data.ts';
import { buildSidebarChatGroups } from '../../features/shell/sidebar-chat-list-model.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';

// The Chat rail tab's landing: the most recently active conversation, or
// Activity when no chats exist yet.
export function DefaultChatPage() {
    const chatsQuery = useChatList();

    if (chatsQuery.isPending) {
        return null;
    }

    const chats = buildSidebarChatGroups(buildChatList(chatsQuery.data)).allChats;
    const mostRecent = [...chats].sort(
        (left, right) => chatTimestamp(right) - chatTimestamp(left)
    )[0];

    return (
        <Navigate replace to={mostRecent ? appRoutes.chat(mostRecent.id) : appRoutes.activity} />
    );
}

function chatTimestamp(chat: { createdAt?: null | string; lastActivityAt?: null | string }) {
    return Date.parse(chat.lastActivityAt ?? chat.createdAt ?? '') || 0;
}
