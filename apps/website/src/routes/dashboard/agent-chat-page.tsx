import { Navigate, useParams } from 'react-router-dom';
import { AgentChatDetail } from '../../features/chats/agent-chat-detail.tsx';
import { buildChatPath } from '../../features/chats/chat-path.ts';

export function AgentChatPage() {
    const { chatId } = useParams<{ chatId: string }>();

    if (!chatId) {
        return <Navigate replace to="/dashboard/overview" />;
    }

    return <Navigate replace to={buildChatPath(chatId)} />;
}

export function ChatPage() {
    const { chatId } = useParams<{ chatId: string }>();

    if (!chatId) {
        return <Navigate replace to="/dashboard/overview" />;
    }

    return <AgentChatDetail chatId={chatId} />;
}
