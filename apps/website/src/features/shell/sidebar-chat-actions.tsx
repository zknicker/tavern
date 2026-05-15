import { PencilEdit02Icon, Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import {
    ContextMenu,
    ContextMenuItem,
    ContextMenuPopup,
    ContextMenuTrigger,
} from '../../components/ui/context-menu.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import type { ChatListItem } from '../chats/chat-list-data.ts';

interface SidebarChatContextMenuProps {
    chat: ChatListItem;
    children: React.ReactNode;
    onArchive: (chat: ChatListItem) => void;
    onRename: (chat: ChatListItem) => void;
}

export function SidebarChatContextMenu({
    chat,
    children,
    onArchive,
    onRename,
}: SidebarChatContextMenuProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger className="block min-w-0">{children}</ContextMenuTrigger>
            <ContextMenuPopup>
                <ContextMenuItem
                    disabled={!canRenameSidebarChat(chat)}
                    onClick={() => onRename(chat)}
                >
                    <Icon className="size-3.5" icon={PencilEdit02Icon} />
                    Rename chat
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onArchive(chat)} variant="destructive">
                    <Icon className="size-3.5" icon={Trash2} />
                    Archive chat
                </ContextMenuItem>
            </ContextMenuPopup>
        </ContextMenu>
    );
}

interface SidebarChatRenameDialogProps {
    chat: ChatListItem | null;
    errorMessage: string | null;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (displayName: string) => Promise<void>;
}

export function SidebarChatRenameDialog({
    chat,
    errorMessage,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatRenameDialogProps) {
    return (
        <Dialog onOpenChange={(open) => !open && onClose()} open={chat !== null}>
            <DialogContent className="max-w-sm" showCloseButton={false}>
                {chat ? (
                    <SidebarChatRenameForm
                        errorMessage={errorMessage}
                        initialDisplayName={chat.displayName}
                        isPending={isPending}
                        key={chat.id}
                        onClose={onClose}
                        onSubmit={onSubmit}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

interface SidebarChatRenameFormProps {
    errorMessage: string | null;
    initialDisplayName: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (displayName: string) => Promise<void>;
}

function SidebarChatRenameForm({
    errorMessage,
    initialDisplayName,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatRenameFormProps) {
    const [displayName, setDisplayName] = React.useState(initialDisplayName);
    const trimmedDisplayName = displayName.trim();
    const canSubmit = trimmedDisplayName.length > 0 && !isPending;

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await onSubmit(trimmedDisplayName);
    });

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader className="pe-6">
                <DialogTitle>Rename chat</DialogTitle>
                <DialogDescription>Choose a short name for the sidebar.</DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-3">
                <Input
                    autoFocus
                    onChange={(event) => setDisplayName(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    value={displayName}
                />
                {errorMessage ? (
                    <div className="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-error text-sm">
                        {errorMessage}
                    </div>
                ) : null}
            </DialogPanel>
            <DialogFooter>
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={!canSubmit} loading={isPending} size="sm" type="submit">
                    Save
                </Button>
            </DialogFooter>
        </form>
    );
}

export function canRenameSidebarChat(chat: Pick<ChatListItem, 'boundAgentIds'>) {
    return chat.boundAgentIds.length === 1;
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong.';
}
