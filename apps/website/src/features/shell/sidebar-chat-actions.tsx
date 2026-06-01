import { PencilEdit02Icon, PinIcon, PinOffIcon, Trash2 } from '@hugeicons/core-free-icons';
import { ColorsIcon as ColorsSolidIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, ColorsIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    ContextMenu,
    ContextMenuItem,
    ContextMenuPopup,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubPopup,
    ContextMenuSubTrigger,
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
import { cn } from '../../lib/utils.ts';
import type { ChatListItem } from '../chats/chat-list-data.ts';
import { pinnedTabColorOptions } from './pinned-tab-options.ts';

const contextMenuIconClassName = 'size-4';

interface SidebarChatContextMenuProps {
    chat: ChatListItem;
    children: React.ReactNode;
    onArchive: (chat: ChatListItem) => void;
    onCloseTab?: (chat: ChatListItem) => void;
    onCustomizeColor?: (chat: ChatListItem, color: string | null) => void;
    onPinChange: (chat: ChatListItem, pinned: boolean) => void;
    onRename: (chat: ChatListItem) => void;
    triggerClassName?: string;
}

export function SidebarChatContextMenu({
    chat,
    children,
    onArchive,
    onCloseTab,
    onCustomizeColor,
    onPinChange,
    onRename,
    triggerClassName,
}: SidebarChatContextMenuProps) {
    const canCustomizePinnedTab = chat.isPinned && onCustomizeColor;
    const canCloseTab = onCloseTab && !chat.isPinned;

    return (
        <ContextMenu>
            <ContextMenuTrigger className={cn('block min-w-0', triggerClassName)}>
                {children}
            </ContextMenuTrigger>
            <ContextMenuPopup>
                <ContextMenuItem
                    disabled={!canRenameSidebarChat(chat)}
                    onClick={() => onRename(chat)}
                >
                    <Icon className={contextMenuIconClassName} icon={PencilEdit02Icon} />
                    Rename chat
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onPinChange(chat, !chat.isPinned)}>
                    <Icon
                        className={contextMenuIconClassName}
                        icon={chat.isPinned ? PinOffIcon : PinIcon}
                    />
                    {chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                </ContextMenuItem>
                {canCustomizePinnedTab ? (
                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <Icon className={contextMenuIconClassName} icon={ColorsIcon} />
                            Color
                        </ContextMenuSubTrigger>
                        <ContextMenuSubPopup>
                            <ContextMenuItem onClick={() => onCustomizeColor(chat, null)}>
                                <Icon className={contextMenuIconClassName} icon={ColorsIcon} />
                                Default
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            {pinnedTabColorOptions.map((option) => (
                                <ContextMenuItem
                                    key={option.id}
                                    onClick={() => onCustomizeColor(chat, option.value)}
                                >
                                    <Icon
                                        className={contextMenuIconClassName}
                                        icon={ColorsSolidIcon}
                                        style={{ color: option.value }}
                                    />
                                    {option.label}
                                </ContextMenuItem>
                            ))}
                        </ContextMenuSubPopup>
                    </ContextMenuSub>
                ) : null}
                <ContextMenuSeparator />
                {canCloseTab ? (
                    <ContextMenuItem onClick={() => onCloseTab(chat)}>
                        <Icon className={contextMenuIconClassName} icon={Cancel01Icon} />
                        Close tab
                    </ContextMenuItem>
                ) : null}
                <ContextMenuItem onClick={() => onArchive(chat)} variant="destructive">
                    <Icon className={contextMenuIconClassName} icon={Trash2} />
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
