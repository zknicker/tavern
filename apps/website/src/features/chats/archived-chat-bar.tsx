import { ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useChatUnarchive } from '../../hooks/chats/use-chat-unarchive.ts';

// Replaces the message composer while a chat is archived: history stays
// readable, sending stays off until the chat is restored.
export function ArchivedChatBar({
    chatId,
    conversationKind,
}: {
    chatId: string;
    conversationKind: string;
}) {
    const unarchiveChat = useChatUnarchive();
    const noun = conversationKind === 'channel' ? 'channel' : 'chat';

    return (
        <div className="px-5 pb-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5">
                <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    icon={ArchiveIcon}
                />
                <p className="min-w-0 flex-1 text-muted-foreground text-sm">
                    This {noun} is archived. Restore it to send new messages.
                </p>
                <Button
                    loading={unarchiveChat.isPending}
                    onClick={() => unarchiveChat.mutate({ chatId })}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    Restore
                </Button>
            </div>
            {unarchiveChat.error ? (
                <p className="pt-2 text-error text-sm">{unarchiveChat.error.message}</p>
            ) : null}
        </div>
    );
}
