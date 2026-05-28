import { Archive02Icon, Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { buildChatList, type ChatListItem } from '../chats/chat-list-data.ts';
import { buildChatPath, buildNewChatDraftPath } from '../chats/chat-path.ts';
import {
    canRenameSidebarChat,
    getErrorMessage,
    SidebarChatContextMenu,
    SidebarChatRenameDialog,
} from './sidebar-chat-actions.tsx';

const sidebarChatLimit = 8;
const archiveConfirmTimeoutMs = 2400;

export function AppSidebarChatList() {
    const location = useLocation();
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const recentChats = React.useMemo(
        () => buildSidebarChatList(buildChatList(chatQuery.data)),
        [chatQuery.data]
    );
    const draftChats = React.useMemo(
        () => buildSidebarDraftChatList(drafts.listDrafts(), recentChats),
        [drafts, recentChats]
    );
    const visibleRecentChats = React.useMemo(
        () => recentChats.slice(0, Math.max(sidebarChatLimit - draftChats.length, 0)),
        [draftChats.length, recentChats]
    );
    const activeDraftRoute = getChatDraftRouteState(location.state);

    React.useEffect(() => {
        const visibleDraft = draftChats.find((draft) => draft.status !== 'error');

        if (!visibleDraft) {
            return;
        }

        markChatTiming('optimistic-sidebar-visible', {
            draftChatId: visibleDraft.id,
            realChatId: visibleDraft.realChatId,
        });
    }, [draftChats]);

    const openRename = React.useCallback(
        (chat: ChatListItem) => {
            updateChat.reset();
            setRenamingChat(chat);
        },
        [updateChat]
    );

    const archiveSidebarChat = React.useCallback(
        async (chat: ChatListItem) => {
            try {
                await archiveChat.mutateAsync({ chatId: chat.id });

                if (location.pathname === buildChatPath(chat.id)) {
                    await navigate('/dashboard/chats');
                }
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep sidebar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [archiveChat, location.pathname, navigate]
    );
    const archiveConfirmation = useInlineDeleteConfirmation({
        getKey: (chat: ChatListItem) => chat.id,
        onConfirm: archiveSidebarChat,
        timeoutMs: archiveConfirmTimeoutMs,
    });

    return (
        <>
            <SidebarGroup className="group/chats pt-1">
                <div className="relative flex h-8 items-center px-2">
                    <div className="font-medium text-[var(--nav-section-label)] text-sm">Chats</div>
                    <Button
                        aria-label="New chat"
                        className="absolute top-1/2 right-[0.0625rem] -translate-y-1/2 opacity-0 group-focus-within/chats:opacity-100 group-hover/chats:opacity-100 [&_svg]:size-[1.0625rem]"
                        render={<NavLink to="/dashboard/chats" />}
                        size="icon-xs"
                        title="New chat"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" icon={Plus} />
                    </Button>
                </div>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {draftChats.map((draft) => {
                            const path = getSidebarDraftPath(draft);
                            const isActive =
                                activeDraftRoute?.draftChatId === draft.id ||
                                (draft.realChatId !== null &&
                                    location.pathname === buildChatPath(draft.realChatId));

                            return (
                                <SidebarDraftChatItem
                                    draft={draft}
                                    isActive={isActive}
                                    key={draft.id}
                                    path={path}
                                />
                            );
                        })}
                        {visibleRecentChats.map((chat) => {
                            const isConfirmingArchive =
                                archiveConfirmation.confirmingKey === chat.id;
                            const isArchivePending =
                                archiveChat.isPending && archiveChat.variables?.chatId === chat.id;

                            return (
                                <SidebarRecentChatItem
                                    chat={chat}
                                    isActive={location.pathname === buildChatPath(chat.id)}
                                    isArchivePending={isArchivePending}
                                    isConfirmingArchive={isConfirmingArchive}
                                    key={chat.id}
                                    onArchive={(selectedChat) => {
                                        void archiveSidebarChat(selectedChat);
                                    }}
                                    onCommitInlineArchive={(selectedChat) => {
                                        void archiveConfirmation.confirm(selectedChat);
                                    }}
                                    onConfirmArchive={() => archiveConfirmation.request(chat)}
                                    onRename={openRename}
                                />
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

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
        </>
    );
}

function SidebarDraftChatItem({
    draft,
    isActive,
    path,
}: {
    draft: ChatStartDraft;
    isActive: boolean;
    path: string;
}) {
    const timelineChatId = draft.realChatId ?? draft.id;
    const timelineState = useChatRuntimeTimelineState(timelineChatId);
    const hasActiveTurn =
        draft.status === 'queued' ||
        draft.status === 'creating' ||
        (draft.status === 'reconciled' && hasLocalActiveTurn(timelineState));

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                className="font-normal"
                isActive={isActive}
                render={<NavLink state={{ draftChatId: draft.id }} to={path} />}
                tooltip={draft.title}
            >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{draft.title}</span>
                    {hasActiveTurn ? (
                        <span aria-hidden="true" className="w-6 shrink-0" />
                    ) : (
                        <span className="shrink-0 text-sidebar-muted text-xs">
                            {getSidebarDraftActivityLabel(draft)}
                        </span>
                    )}
                </span>
            </SidebarMenuButton>
            <SidebarChatActiveTurnIndicator hidden={!hasActiveTurn} />
        </SidebarMenuItem>
    );
}

function SidebarRecentChatItem({
    chat,
    isActive,
    isArchivePending,
    isConfirmingArchive,
    onArchive,
    onCommitInlineArchive,
    onConfirmArchive,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    isArchivePending: boolean;
    isConfirmingArchive: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCommitInlineArchive: (chat: ChatListItem) => void;
    onConfirmArchive: () => void;
    onRename: (chat: ChatListItem) => void;
}) {
    const title = getSidebarChatTitle(chat);
    const path = buildChatPath(chat.id);
    const timelineState = useChatRuntimeTimelineState(chat.id);
    const hasActiveTurn = chat.hasActiveTurn || hasLocalActiveTurn(timelineState);

    return (
        <SidebarMenuItem>
            <SidebarChatContextMenu chat={chat} onArchive={onArchive} onRename={onRename}>
                <SidebarMenuButton
                    className="font-normal group-focus-within/menu-item:bg-sidebar-accent group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground"
                    data-archive-confirm={isConfirmingArchive ? '' : undefined}
                    isActive={isActive}
                    render={<NavLink to={path} />}
                    tooltip={title}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        {isConfirmingArchive ? (
                            <span aria-hidden="true" className="w-[52px] shrink-0" />
                        ) : null}
                        <SidebarChatActivity chat={chat} hidden={hasActiveTurn} />
                        {hasActiveTurn && !(isConfirmingArchive || isArchivePending) ? (
                            <span aria-hidden="true" className="w-6 shrink-0" />
                        ) : null}
                    </span>
                </SidebarMenuButton>
                <SidebarChatActiveTurnIndicator
                    hidden={isConfirmingArchive || isArchivePending || !hasActiveTurn}
                />
                <SidebarChatArchiveAction
                    confirm={isConfirmingArchive}
                    isPending={isArchivePending}
                    onArchive={() => onCommitInlineArchive(chat)}
                    onConfirm={onConfirmArchive}
                />
            </SidebarChatContextMenu>
        </SidebarMenuItem>
    );
}

function SidebarChatActivity({ chat, hidden }: { chat: ChatListItem; hidden: boolean }) {
    if (hidden) {
        return null;
    }

    return (
        <span className="shrink-0 text-sidebar-muted text-xs group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0">
            {formatSidebarActivityLabel(chat.lastActivityLabel)}
        </span>
    );
}

function SidebarChatActiveTurnIndicator({ hidden }: { hidden: boolean }) {
    if (hidden) {
        return null;
    }

    return (
        <span
            className="pointer-events-none absolute top-1/2 right-0.5 z-10 inline-flex size-6 -translate-y-1/2 items-center justify-center text-sidebar-muted group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0"
            title="Agent turn in progress"
        >
            <Spinner className="size-4" />
        </span>
    );
}

function SidebarChatArchiveAction({
    confirm,
    isPending,
    onArchive,
    onConfirm,
}: {
    confirm: boolean;
    isPending: boolean;
    onArchive: () => void;
    onConfirm: () => void;
}) {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (isPending) {
            return;
        }

        if (confirm) {
            onArchive();
            return;
        }

        onConfirm();
    };

    const controlClassName =
        'absolute top-1/2 right-0.5 z-10 size-6 -translate-y-1/2 border-transparent bg-transparent text-sidebar-muted opacity-0 shadow-none hover:bg-transparent hover:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-pressed:bg-transparent sm:size-6 [&_svg]:size-4 [&_svg]:opacity-100';

    if (confirm) {
        return (
            <Button
                aria-label="Confirm archive chat"
                className="absolute top-1/2 right-1 z-10 -translate-y-1/2"
                disabled={isPending}
                loading={isPending}
                onClick={handleClick}
                size="xs"
                title="Confirm archive chat"
                variant="destructive-soft"
            >
                Confirm
            </Button>
        );
    }

    return (
        <Button
            aria-label="Archive chat"
            className={controlClassName}
            disabled={isPending}
            loading={isPending}
            onClick={handleClick}
            size="icon-xs"
            title="Archive chat"
            variant="ghost"
        >
            <Icon aria-hidden="true" icon={Archive02Icon} />
        </Button>
    );
}

export function formatSidebarActivityLabel(label: string) {
    if (label.endsWith(' ago')) {
        return label.slice(0, -4);
    }

    return label;
}

function useInlineDeleteConfirmation<TItem>({
    getKey,
    onConfirm,
    timeoutMs,
}: {
    getKey: (item: TItem) => string;
    onConfirm: (item: TItem) => Promise<void> | void;
    timeoutMs: number;
}) {
    const [confirmingKey, setConfirmingKey] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!confirmingKey) {
            return;
        }

        const timeout = window.setTimeout(() => setConfirmingKey(null), timeoutMs);

        return () => window.clearTimeout(timeout);
    }, [confirmingKey, timeoutMs]);

    const request = React.useCallback(
        (item: TItem) => {
            setConfirmingKey(getKey(item));
        },
        [getKey]
    );

    const confirm = React.useCallback(
        async (item: TItem) => {
            if (confirmingKey !== getKey(item)) {
                setConfirmingKey(getKey(item));
                return;
            }

            setConfirmingKey(null);
            await onConfirm(item);
        },
        [confirmingKey, getKey, onConfirm]
    );

    return { confirm, confirmingKey, request };
}

export function buildSidebarChatList(chats: ChatListItem[]) {
    return chats.filter(isSidebarTavernChat).slice(0, sidebarChatLimit);
}

export function buildSidebarDraftChatList(drafts: ChatStartDraft[], chats: ChatListItem[]) {
    const syncedChatIds = new Set(chats.map((chat) => chat.id));

    return drafts
        .filter((draft) => !(draft.realChatId && syncedChatIds.has(draft.realChatId)))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, sidebarChatLimit);
}

export function getSidebarDraftPath(draft: ChatStartDraft) {
    return draft.realChatId ? buildChatPath(draft.realChatId) : buildNewChatDraftPath();
}

export function getSidebarDraftActivityLabel(draft: Pick<ChatStartDraft, 'status'>) {
    if (draft.status === 'error') {
        return 'failed';
    }

    if (draft.status === 'queued' || draft.status === 'creating') {
        return 'starting';
    }

    return 'just now';
}

export function isSidebarTavernChat(
    chat: Pick<ChatListItem, 'framework' | 'type'>
): chat is ChatListItem {
    return chat.framework === 'tavern' && chat.type === 'tavern';
}

export function getSidebarChatTitle(chat: ChatListItem) {
    return resolveTavernChatName(chat);
}

export function hasLocalActiveTurn(state: Pick<ChatTimelineState, 'activeTurn'>) {
    return state.activeTurn !== null;
}
