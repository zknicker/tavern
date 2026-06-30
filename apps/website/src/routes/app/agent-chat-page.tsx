import { Navigate, useParams } from 'react-router-dom';
import { AgentChatDetail } from '../../features/chats/agent-chat-detail.tsx';
import { buildChatPath } from '../../features/chats/chat-path.ts';
import { appRoutes } from '../../lib/app-routes.ts';

export function AgentChatPage() {
    const { chatId } = useParams<{ chatId: string }>();

    if (!chatId) {
        return <Navigate replace to={appRoutes.overview} />;
    }

    return <Navigate replace to={buildChatPath(chatId)} />;
}

export function ChatPage() {
    const { chatId } = useParams<{ chatId: string }>();

    if (!chatId) {
        return <Navigate replace to={appRoutes.overview} />;
    }

    return <AgentChatDetail chatId={chatId} />;
}
