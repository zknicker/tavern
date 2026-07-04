import type { useChatSystemPrompt } from '../../../hooks/chats/use-chat-system-prompt.ts';
import type { useChatUpdate } from '../../../hooks/chats/use-chat-update.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { ChannelDialog } from '../../chats/channel-dialog.tsx';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import {
    canRenameSidebarChat,
    SidebarChatRenameDialog,
    SidebarChatSystemPromptDialog,
} from '../sidebar-chat-actions.tsx';

/** The rename and system-prompt dialogs driven from the chat-tab context menu. */
export function TavernChatTabDialogs({
    agents,
    agentsPending,
    editingSystemPromptChat,
    editingParticipantsChat,
    renamingChat,
    setEditingSystemPromptChat,
    setEditingParticipantsChat,
    setRenamingChat,
    systemPrompt,
    updateChat,
}: {
    agents: AgentListOutput['agents'];
    agentsPending: boolean;
    editingSystemPromptChat: ChatListItem | null;
    editingParticipantsChat: ChatListItem | null;
    renamingChat: ChatListItem | null;
    setEditingSystemPromptChat: (chat: ChatListItem | null) => void;
    setEditingParticipantsChat: (chat: ChatListItem | null) => void;
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
            <ChannelDialog
                agents={agents}
                agentsPending={agentsPending}
                errorMessage={updateChat.error?.message ?? null}
                initialAgentIds={editingParticipantsChat?.boundAgentIds ?? []}
                initialDisplayName={editingParticipantsChat?.displayName ?? ''}
                isPending={updateChat.isPending}
                onClose={() => {
                    if (!updateChat.isPending) {
                        updateChat.reset();
                        setEditingParticipantsChat(null);
                    }
                }}
                onSubmit={async (input) => {
                    if (!editingParticipantsChat) {
                        return;
                    }

                    await updateChat.mutateAsync({
                        agentIds: input.agentIds,
                        chatId: editingParticipantsChat.id,
                        displayName: editingParticipantsChat.displayName,
                    });
                    setEditingParticipantsChat(null);
                }}
                open={editingParticipantsChat !== null}
                showDisplayName={false}
                submitLabel="Save"
                title="Channel participants"
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
