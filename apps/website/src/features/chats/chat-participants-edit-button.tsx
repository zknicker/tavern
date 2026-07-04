import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { ChannelDialog } from './channel-dialog.tsx';
import type { ChatListItem } from './chat-list-data.ts';

export function ChatParticipantsEditButton({ chat }: { chat: ChatListItem }) {
    const agentsQuery = useAgentList();
    const updateChat = useChatUpdate();
    const [open, setOpen] = React.useState(false);

    if (!canEditChatParticipants(chat)) {
        return null;
    }

    return (
        <>
            <Button
                aria-label="Edit participants"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                    updateChat.reset();
                    setOpen(true);
                }}
                size="icon-sm"
                title="Edit participants"
                variant="ghost"
            >
                <Icon className="size-4" icon={PencilEdit02Icon} />
            </Button>
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                errorMessage={updateChat.error?.message ?? null}
                initialAgentIds={chat.boundAgentIds}
                initialDisplayName={chat.displayName}
                isPending={updateChat.isPending}
                onClose={() => {
                    if (!updateChat.isPending) {
                        updateChat.reset();
                        setOpen(false);
                    }
                }}
                onSubmit={async (input) => {
                    await updateChat.mutateAsync({
                        agentIds: input.agentIds,
                        chatId: chat.id,
                        displayName: chat.displayName,
                    });
                    setOpen(false);
                }}
                open={open}
                showDisplayName={false}
                submitLabel="Save"
                title="Channel participants"
            />
        </>
    );
}

export function canEditChatParticipants(chat: Pick<ChatListItem, 'conversationKind' | 'type'>) {
    return chat.type === 'tavern' && chat.conversationKind === 'channel';
}
