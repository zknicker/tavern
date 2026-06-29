import type { useChatSystemPrompt } from '../../../hooks/chats/use-chat-system-prompt.ts';
import type { useChatUpdate } from '../../../hooks/chats/use-chat-update.ts';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import {
    canRenameSidebarChat,
    SidebarChatRenameDialog,
    SidebarChatSystemPromptDialog,
} from '../sidebar-chat-actions.tsx';

/** The rename and system-prompt dialogs driven from the chat-tab context menu. */
export function TavernChatTabDialogs({
    editingSystemPromptChat,
    renamingChat,
    setEditingSystemPromptChat,
    setRenamingChat,
    systemPrompt,
    updateChat,
}: {
    editingSystemPromptChat: ChatListItem | null;
    renamingChat: ChatListItem | null;
    setEditingSystemPromptChat: (chat: ChatListItem | null) => void;
    setRenamingChat: (chat: ChatListItem | null) => void;
    systemPrompt: ReturnType<typeof useChatSystemPrompt>;
    updateChat: ReturnType<typeof useChatUpdate>;
}) {
    return (
        <>
            <SidebarChatRenameDialog
                chat={renamingChat}
                errorMessage={updateChat.error?.message ?? null}
                isPending={updateChat.isPending}
                onClose={() => {
                    if (!updateChat.isPending) {
                        updateChat.reset();
                        setRenamingChat(null);
                    }
                }}
                onSubmit={async (displayName) => {
                    if (!(renamingChat && canRenameSidebarChat(renamingChat))) {
                        return;
                    }

                    await updateChat.mutateAsync({
                        agentIds: renamingChat.boundAgentIds,
                        chatId: renamingChat.id,
                        displayName,
                    });
                    setRenamingChat(null);
                }}
            />
            <SidebarChatSystemPromptDialog
                chat={editingSystemPromptChat}
                errorMessage={systemPrompt.error?.message ?? null}
                isPending={systemPrompt.isPending}
                onClose={() => {
                    if (!systemPrompt.isPending) {
                        systemPrompt.reset();
                        setEditingSystemPromptChat(null);
                    }
                }}
                onSubmit={async (nextSystemPrompt) => {
                    if (!editingSystemPromptChat) {
                        return;
                    }

                    await systemPrompt.mutateAsync({
                        chatId: editingSystemPromptChat.id,
                        systemPrompt: nextSystemPrompt,
                    });
                    setEditingSystemPromptChat(null);
                }}
            />
        </>
    );
}
