import { Navigate } from 'react-router-dom';
import { buildChatList } from '../../features/chats/chat-list-data.ts';
import { selectMostRecentChatRailConversation } from '../../features/shell/sidebar-chat-list-model.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';

// The Chat rail tab's landing: the most recently active conversation, or
// Activity when no chats exist yet.
export function DefaultChatPage() {
    const chatsQuery = useChatList();

    if (chatsQuery.isPending) {
        return null;
    }

    const mostRecent = selectMostRecentChatRailConversation(buildChatList(chatsQuery.data));

    return (
        <Navigate replace to={mostRecent ? appRoutes.chat(mostRecent.id) : appRoutes.activity} />
    );
}
