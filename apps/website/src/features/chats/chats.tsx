import * as React from 'react';
import { useAgentAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { useAgentListSuspense } from '../../hooks/agents/use-agent-list.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { useChatListSuspense } from '../../hooks/chats/use-chat-list.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { ChatEditorDrawer } from './chat-editor-drawer.tsx';
import { buildChatList, type ChatListItem } from './chat-list-data.ts';
import { ChatsList } from './chats-list.tsx';

export function Chats() {
    const [agents] = useAgentListSuspense();
    const [chatData] = useChatListSuspense();
    const avatarDirectory = useAgentAvatarDirectory(agents.agents);
    const chats = React.useMemo(() => buildChatList(chatData), [chatData]);
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const [editingChat, setEditingChat] = React.useState<ChatListItem | null>(null);
    const isEditorOpen = editingChat !== null;

    const openEdit = React.useCallback(
        (chat: ChatListItem) => {
            updateChat.reset();
            archiveChat.reset();
            setEditingChat(chat);
        },
        [archiveChat, updateChat]
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ChatsList
                agents={agents.agents}
                avatarDirectory={avatarDirectory}
                chats={chats}
                onArchive={async (chat) => {
                    // biome-ignore lint/suspicious/noAlert: Browser confirm is the current archive safeguard.
                    if (!window.confirm(`Archive chat "${chat.displayName}"?`)) {
                        return;
                    }

                    await archiveChat.mutateAsync({ chatId: chat.id });
                }}
                onEdit={openEdit}
            />

            <ChatEditorDrawer
                chat={editingChat}
                errorMessage={updateChat.error?.message ?? archiveChat.error?.message ?? null}
                isOpen={isEditorOpen}
                isPending={updateChat.isPending}
                onClose={() => {
                    if (!updateChat.isPending) {
                        updateChat.reset();
                        setEditingChat(null);
                    }
                }}
                onSubmit={async (input) => {
                    if (!editingChat) {
                        return;
                    }

                    await updateChat.mutateAsync({
                        agentIds: input.agentIds,
                        chatId: editingChat.id,
                        displayName: input.displayName,
                    });

                    setEditingChat(null);
                }}
            />
        </div>
    );
}
