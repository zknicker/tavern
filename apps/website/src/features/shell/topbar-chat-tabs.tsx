import { Archive02Icon } from '@hugeicons/core-free-icons';
import { CancelCircleIcon as CancelCircleDuotoneIcon } from '@hugeicons-pro/core-duotone-rounded';
import {
    BubbleChatIcon,
    BubbleChatTemporaryIcon,
    CancelCircleIcon,
    Joystick04Icon,
    MoreHorizontalIcon,
    PlusSignIcon,
    RubiksCubeIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useChatPin } from '../../hooks/chats/use-chat-pin.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatTabAppearance } from '../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { routeTabs } from '../../hooks/dashboard/use-route-tab.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { formatTimestamp } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { buildChatList, type ChatListItem } from '../chats/chat-list-data.ts';
import { buildChatPath, buildNewChatDraftPath } from '../chats/chat-path.ts';
import {
    canRenameSidebarChat,
    getErrorMessage,
    SidebarChatContextMenu,
    SidebarChatRenameDialog,
} from './sidebar-chat-actions.tsx';
import {
    buildSidebarChatGroups,
    formatSidebarActivityLabel,
    getSidebarDraftActivityLabel,
} from './sidebar-chat-list.tsx';

const openChatTabsStorageKey = 'tavern.chatTabs.openChatIds.v1';
const openChatTabsChangedEvent = 'tavern:open-chat-tabs-changed';

export function TopbarChatTabs({
    activeRouteTab,
    onSelectRouteTab,
}: {
    activeRouteTab: RouteTab | null;
    onSelectRouteTab: (tab: RouteTab) => void;
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const pinChat = useChatPin();
    const tabAppearance = useChatTabAppearance();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [openChatIds, setOpenChatIds] = useOpenChatTabIds();
    const topbarChats = React.useMemo(
        () => buildSidebarChatGroups(buildChatList(chatQuery.data)),
        [chatQuery.data]
    );
    const sortedChats = React.useMemo(
        () => sortChatsByCreatedAt(topbarChats.allChats),
        [topbarChats.allChats]
    );
    const openChatIdSet = React.useMemo(() => new Set(openChatIds), [openChatIds]);
    const pinnedChats = React.useMemo(
        () => sortedChats.filter((chat) => chat.isPinned),
        [sortedChats]
    );
    const visibleRecentChats = React.useMemo(
        () => sortedChats.filter((chat) => !chat.isPinned && openChatIdSet.has(chat.id)),
        [openChatIdSet, sortedChats]
    );
    const draftChats = React.useMemo(
        () => buildTopbarDraftChatList(drafts.listDrafts(), topbarChats.allChats),
        [drafts, topbarChats.allChats]
    );
    const activeDraftRoute = getChatDraftRouteState(location.state);
    const activeChatId = getRouteChatId(location.pathname);
    const activeDraft = activeDraftRoute?.draftChatId
        ? draftChats.find((draft) => draft.id === activeDraftRoute.draftChatId)
        : draftChats.find(
              (draft) => draft.realChatId !== null && draft.realChatId === activeChatId
          );
    const activeChatTabValue = activeDraft ? getDraftTabValue(activeDraft.id) : activeChatId;
    const activeTabValue = activeRouteTab ? getRouteTabValue(activeRouteTab) : activeChatTabValue;
    const [selectedTabValue, setSelectedTabValue] = React.useState(activeTabValue ?? '');
    const activeChat = activeChatId
        ? (topbarChats.allChats.find((chat) => chat.id === activeChatId) ?? null)
        : null;
    const selectedChat = getSelectedChat(selectedTabValue, topbarChats.allChats);
    const activeChatIndicatorStyle =
        selectedChat?.isPinned && selectedChat.tabAppearance.color
            ? buildPinnedTabIndicatorStyle(selectedChat.tabAppearance.color)
            : undefined;

    React.useEffect(() => {
        setSelectedTabValue(activeTabValue ?? '');
    }, [activeTabValue]);

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

    React.useEffect(() => {
        if (!(activeChat && !activeChat.isPinned)) {
            return;
        }

        if (openChatIds.includes(activeChat.id)) {
            return;
        }

        setOpenChatIds([...openChatIds, activeChat.id]);
    }, [activeChat, openChatIds, setOpenChatIds]);

    const closeChatTab = React.useCallback(
        async (chat: ChatListItem) => {
            if (chat.isPinned) {
                return;
            }

            const nextOpenIds = openChatIds.filter((chatId) => chatId !== chat.id);
            setOpenChatIds(nextOpenIds);

            if (location.pathname !== buildChatPath(chat.id)) {
                return;
            }

            await navigate('/dashboard/overview');
        },
        [location.pathname, navigate, openChatIds, setOpenChatIds]
    );

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) {
                return;
            }

            if (event.key.toLowerCase() === 't') {
                event.preventDefault();
                void navigate('/dashboard/overview');
                return;
            }

            if (event.key.toLowerCase() === 'w' && activeChat && !activeChat.isPinned) {
                event.preventDefault();
                void closeChatTab(activeChat);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeChat, closeChatTab, navigate]);

    const archiveTopbarChat = React.useCallback(
        async (chat: ChatListItem) => {
            try {
                await archiveChat.mutateAsync({ chatId: chat.id });
                setOpenChatIds(openChatIds.filter((chatId) => chatId !== chat.id));

                if (location.pathname === buildChatPath(chat.id)) {
                    await navigate('/dashboard/overview');
                }
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep topbar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [archiveChat, location.pathname, navigate, openChatIds, setOpenChatIds]
    );

    const pinTopbarChat = React.useCallback(
        async (chat: ChatListItem, pinned: boolean) => {
            try {
                await pinChat.mutateAsync({ chatId: chat.id, pinned });

                if (!pinned) {
                    setOpenChatIds([...openChatIds, chat.id]);
                }
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep topbar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [openChatIds, pinChat, setOpenChatIds]
    );

    const setPinnedTabColor = React.useCallback(
        async (chat: ChatListItem, color: string | null) => {
            try {
                await tabAppearance.mutateAsync({
                    chatId: chat.id,
                    color,
                });
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep topbar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [tabAppearance]
    );

    return (
        <>
            <TabsSubtle
                aria-label="Primary"
                className="scrollbar-hidden min-w-0 flex-1 overflow-x-auto overscroll-x-contain pr-1"
                onValueChange={(value) => {
                    setSelectedTabValue(value);

                    const routeTab = parseRouteTabValue(value);

                    if (routeTab) {
                        onSelectRouteTab(routeTab);
                        return;
                    }

                    const draftId = parseDraftTabValue(value);

                    if (draftId) {
                        const draft = draftChats.find((entry) => entry.id === draftId);

                        if (draft) {
                            void navigate(getTopbarDraftPath(draft), {
                                state: { draftChatId: draft.id },
                            });
                        }

                        return;
                    }

                    if (getSelectedChat(value, topbarChats.allChats)) {
                        void navigate(buildChatPath(value));
                    }
                }}
                value={selectedTabValue}
            >
                <TabsSubtleList className="gap-1 overflow-visible" style={activeChatIndicatorStyle}>
                    {routeTabs.map((tab) => (
                        <TabsSubtleItem
                            icon={getRouteTabIcon(tab.id)}
                            iconNode={getRouteTabIconNode(tab.id)}
                            key={tab.id}
                            label={tab.label}
                            value={getRouteTabValue(tab.id)}
                        />
                    ))}
                    <div
                        aria-hidden="true"
                        className="mx-1 h-6 shrink-0 border-border/60 border-r"
                    />
                    {pinnedChats.map((chat) => (
                        <TopbarRecentChatTab
                            chat={chat}
                            isActive={location.pathname === buildChatPath(chat.id)}
                            isArchivePending={
                                archiveChat.isPending && archiveChat.variables?.chatId === chat.id
                            }
                            key={chat.id}
                            onArchive={(selectedChat) => {
                                void archiveTopbarChat(selectedChat);
                            }}
                            onCloseTab={(selectedChat) => {
                                void closeChatTab(selectedChat);
                            }}
                            onCustomizeColor={(selectedChat, color) => {
                                tabAppearance.reset();
                                void setPinnedTabColor(selectedChat, color);
                            }}
                            onPinChange={(selectedChat, pinned) => {
                                void pinTopbarChat(selectedChat, pinned);
                            }}
                            onRename={(selectedChat) => {
                                updateChat.reset();
                                setRenamingChat(selectedChat);
                            }}
                        />
                    ))}
                    {draftChats.map((draft) => {
                        const isActive =
                            activeDraftRoute?.draftChatId === draft.id ||
                            (draft.realChatId !== null &&
                                location.pathname === buildChatPath(draft.realChatId));

                        return (
                            <TopbarDraftChatTab draft={draft} isActive={isActive} key={draft.id} />
                        );
                    })}
                    {visibleRecentChats.map((chat) => (
                        <TopbarRecentChatTab
                            chat={chat}
                            isActive={location.pathname === buildChatPath(chat.id)}
                            isArchivePending={
                                archiveChat.isPending && archiveChat.variables?.chatId === chat.id
                            }
                            key={chat.id}
                            onArchive={(selectedChat) => {
                                void archiveTopbarChat(selectedChat);
                            }}
                            onCloseTab={(selectedChat) => {
                                void closeChatTab(selectedChat);
                            }}
                            onCustomizeColor={(selectedChat, color) => {
                                tabAppearance.reset();
                                void setPinnedTabColor(selectedChat, color);
                            }}
                            onPinChange={(selectedChat, pinned) => {
                                void pinTopbarChat(selectedChat, pinned);
                            }}
                            onRename={(selectedChat) => {
                                updateChat.reset();
                                setRenamingChat(selectedChat);
                            }}
                        />
                    ))}
                </TabsSubtleList>
            </TabsSubtle>
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

export function TopbarAllChatsMenuButton() {
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const [openChatIds, setOpenChatIds] = useOpenChatTabIds();
    const chats = React.useMemo(
        () => sortChatsByCreatedAt(buildSidebarChatGroups(buildChatList(chatQuery.data)).allChats),
        [chatQuery.data]
    );

    const openChat = React.useCallback(
        async (chat: ChatListItem) => {
            if (!(chat.isPinned || openChatIds.includes(chat.id))) {
                setOpenChatIds([...openChatIds, chat.id]);
            }

            await navigate(buildChatPath(chat.id));
        },
        [navigate, openChatIds, setOpenChatIds]
    );

    return (
        <Menu>
            <MenuTrigger
                render={
                    <Button
                        aria-label="All chats"
                        className="size-7 rounded-md"
                        size="icon-sm"
                        title="All chats"
                        variant="ghost"
                    />
                }
            >
                <Icon aria-hidden="true" className="size-4.5" icon={MoreHorizontalIcon} size={18} />
            </MenuTrigger>
            <MenuPopup align="end" className="w-80">
                {chats.length > 0 ? (
                    chats.map((chat) => (
                        <MenuItem
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5"
                            key={chat.id}
                            onClick={() => {
                                void openChat(chat);
                            }}
                        >
                            <Icon
                                className="size-4 shrink-0"
                                icon={chat.isPinned ? BubbleChatIcon : BubbleChatTemporaryIcon}
                            />
                            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-none">
                                {resolveTavernChatName(chat)}
                            </span>
                            <span
                                className="shrink-0 text-muted-foreground text-xs tabular-nums"
                                title={formatTopbarChatActivityTitle(chat)}
                            >
                                {formatSidebarActivityLabel(chat.lastActivityLabel)}
                            </span>
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem disabled>No chats</MenuItem>
                )}
            </MenuPopup>
        </Menu>
    );
}

export function TopbarNewChatButton() {
    return (
        <Button
            aria-label="New chat"
            className="size-7 rounded-md"
            render={<NavLink to="/dashboard/overview" />}
            size="icon-sm"
            title="New chat"
            variant="secondary"
        >
            <Icon aria-hidden="true" className="size-4.5" icon={PlusSignIcon} size={18} />
        </Button>
    );
}

function TopbarDraftChatTab({ draft, isActive }: { draft: ChatStartDraft; isActive: boolean }) {
    const timelineChatId = draft.realChatId ?? draft.id;
    const timelineState = useChatRuntimeTimelineState(timelineChatId);
    const hasActiveTurn =
        draft.status === 'queued' ||
        draft.status === 'creating' ||
        (draft.status === 'reconciled' && hasLocalActiveTurn(timelineState));

    return (
        <TabsSubtleItem
            aria-current={isActive ? 'page' : undefined}
            className={topbarChatTabButtonClassName({
                isActive,
                tone: draft.status === 'error' ? 'error' : 'default',
            })}
            iconNode={<TopbarChatTabIcon isActiveTurn={hasActiveTurn} />}
            label={draft.title}
            title={draft.title}
            value={getDraftTabValue(draft.id)}
        >
            <span className="block min-w-0 flex-1 truncate leading-normal">{draft.title}</span>
            {hasActiveTurn ? null : (
                <span className="flex shrink-0 items-center text-[0.6875rem] text-muted-foreground leading-none">
                    {getSidebarDraftActivityLabel(draft)}
                </span>
            )}
        </TabsSubtleItem>
    );
}

function TopbarRecentChatTab({
    chat,
    isActive,
    isArchivePending,
    onArchive,
    onCloseTab,
    onCustomizeColor,
    onPinChange,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    isArchivePending: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCloseTab: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onPinChange: (chat: ChatListItem, pinned: boolean) => void;
    onRename: (chat: ChatListItem) => void;
}) {
    const title = resolveTavernChatName(chat);
    const timelineState = useChatRuntimeTimelineState(chat.id);
    const hasActiveTurn = chat.hasActiveTurn || hasLocalActiveTurn(timelineState);
    const tabColor = chat.isPinned ? chat.tabAppearance.color : null;
    const canClose = !(chat.isPinned || hasActiveTurn);

    return (
        <SidebarChatContextMenu
            chat={chat}
            onArchive={onArchive}
            onCloseTab={onCloseTab}
            onCustomizeColor={onCustomizeColor}
            onPinChange={onPinChange}
            onRename={onRename}
            triggerClassName="no-drag h-7 shrink-0 overflow-hidden"
        >
            <div className="group/tab relative h-7">
                <TabsSubtleItem
                    aria-current={isActive ? 'page' : undefined}
                    className={topbarChatTabButtonClassName({ isActive })}
                    iconNode={
                        <TopbarChatTabIcon
                            className={canClose ? 'group-hover/tab:opacity-0' : null}
                            isActiveTurn={hasActiveTurn}
                            isPinned={chat.isPinned}
                        />
                    }
                    label={title}
                    style={tabColor ? buildPinnedTabStyle(tabColor, isActive) : undefined}
                    title={title}
                    value={chat.id}
                >
                    <span className="block min-w-0 flex-1 truncate leading-normal">{title}</span>
                    {isArchivePending ? (
                        <Icon
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                            icon={Archive02Icon}
                        />
                    ) : null}
                </TabsSubtleItem>
                {canClose ? (
                    <button
                        aria-label="Close tab"
                        className="no-drag group/close absolute top-1/2 left-1.5 z-20 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--topbar-tab-close)] transition-colors hover:text-[var(--topbar-tab-close-hover)] group-hover/tab:flex"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onCloseTab(chat);
                        }}
                        onPointerDown={(event) => {
                            event.stopPropagation();
                        }}
                        style={buildChatTabCloseStyle(tabColor)}
                        title="Close tab"
                        type="button"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4 group-hover/close:hidden"
                            icon={CancelCircleIcon}
                            size={16}
                        />
                        <Icon
                            aria-hidden="true"
                            className="hidden size-4 group-hover/close:block [&_path:first-child]:opacity-20"
                            icon={CancelCircleDuotoneIcon}
                            size={16}
                        />
                    </button>
                ) : null}
            </div>
        </SidebarChatContextMenu>
    );
}

function TopbarChatTabIcon({
    className,
    isActiveTurn,
    isPinned = false,
}: {
    className?: string | null;
    isActiveTurn: boolean;
    isPinned?: boolean;
}) {
    if (isActiveTurn) {
        return <Spinner className={cn('size-4 shrink-0', className)} />;
    }

    return (
        <Icon
            aria-hidden="true"
            className={cn('size-4 shrink-0', className)}
            icon={isPinned ? BubbleChatIcon : BubbleChatTemporaryIcon}
            size={16}
        />
    );
}

function topbarChatTabButtonClassName({
    isActive,
    tone = 'default',
}: {
    isActive: boolean;
    tone?: 'default' | 'error';
}) {
    return cn(
        'no-drag h-7 w-fit max-w-[180px] justify-start overflow-hidden rounded-lg px-2 [&_svg]:opacity-80',
        isActive
            ? 'text-[var(--topbar-tab-active-foreground)] hover:bg-transparent'
            : 'text-muted-foreground hover:bg-[var(--topbar-tab-hover)] hover:text-foreground',
        tone === 'error' ? 'text-error-foreground hover:text-error-foreground' : null
    );
}

function sortChatsByCreatedAt(chats: ChatListItem[]) {
    return [...chats].sort(
        (left, right) =>
            compareCreatedAt(left.createdAt, right.createdAt) ||
            left.title.localeCompare(right.title)
    );
}

function formatTopbarChatActivityTitle(chat: ChatListItem) {
    return chat.lastActivityAt ? formatTimestamp(chat.lastActivityAt) : chat.lastActivityLabel;
}

function compareCreatedAt(left: string | null, right: string | null) {
    if (left && right) {
        return right.localeCompare(left);
    }

    if (left) {
        return -1;
    }

    if (right) {
        return 1;
    }

    return 0;
}

function buildTopbarDraftChatList(drafts: ChatStartDraft[], chats: ChatListItem[]) {
    const syncedChatIds = new Set(chats.map((chat) => chat.id));

    return drafts
        .filter((draft) => !(draft.realChatId && syncedChatIds.has(draft.realChatId)))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function getTopbarDraftPath(draft: ChatStartDraft) {
    return draft.realChatId ? buildChatPath(draft.realChatId) : buildNewChatDraftPath();
}

function getDraftTabValue(draftChatId: string) {
    return `draft:${draftChatId}`;
}

function parseDraftTabValue(value: string) {
    return value.startsWith('draft:') ? value.slice('draft:'.length) : null;
}

function getRouteTabValue(tab: RouteTab) {
    return `route:${tab}`;
}

function parseRouteTabValue(value: string): RouteTab | null {
    if (!value.startsWith('route:')) {
        return null;
    }

    const tab = value.slice('route:'.length);

    return isRouteTab(tab) ? tab : null;
}

function isRouteTab(value: string): value is RouteTab {
    return routeTabs.some((tab) => tab.id === value);
}

function getSelectedChat(value: string, chats: ChatListItem[]) {
    if (!value || value.startsWith('route:') || value.startsWith('draft:')) {
        return null;
    }

    return chats.find((chat) => chat.id === value) ?? null;
}

function getRouteTabIcon(tab: RouteTab) {
    switch (tab) {
        case 'cortex':
            return RubiksCubeIcon;
        case 'cron':
        case 'overview':
            return undefined;
    }
}

function getRouteTabIconNode(tab: RouteTab) {
    switch (tab) {
        case 'cron':
            return (
                <Icon
                    aria-hidden="true"
                    className="size-5 shrink-0 -translate-y-px opacity-80 transition-opacity duration-150 group-data-active:opacity-100"
                    icon={Joystick04Icon}
                    size={20}
                />
            );
        case 'overview':
            return <TavernTabIcon aria-hidden="true" className="size-5 shrink-0" />;
        case 'cortex':
            return undefined;
    }
}

function TavernTabIcon({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'svg'>): React.ReactElement {
    return (
        <svg
            className={className}
            fill="none"
            viewBox="0 0 1024 1024"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Tavern</title>
            <path
                d="M837.014 106.707C851.626 106.723 863.499 118.589 863.499 133.265V752.478C863.499 752.67 863.495 752.917 863.485 753.273L863.47 753.75L863.48 754.228C863.492 754.864 863.499 755.435 863.499 755.97C863.498 774.321 854.129 795.048 834.188 816.85C814.396 838.489 785.663 859.494 750.975 877.918C681.515 914.811 591.713 939.5 511.5 939.5C431.188 939.5 342.43 915.576 274.095 879.526C239.962 861.518 211.795 840.94 192.425 819.648C172.943 798.231 163.74 777.69 163.74 759.238C163.74 758.665 163.745 758.085 163.756 757.496L163.766 757.018L163.751 756.54C163.743 756.259 163.74 755.995 163.74 755.745V136.532C163.74 121.847 175.628 109.975 190.253 109.975H190.354L837.014 106.707Z"
                stroke="currentColor"
                strokeWidth="40"
            />
            <path
                d="M521.117 237.815L548.077 329.175C563.952 382.975 606.031 425.048 659.825 440.923L751.185 467.883C760.272 470.566 760.272 483.434 751.185 486.117L659.825 513.077C606.025 528.952 563.952 571.031 548.077 624.825L521.117 716.185C518.434 725.272 505.566 725.272 502.883 716.185L475.923 624.825C460.048 571.025 417.969 528.952 364.175 513.077L272.815 486.117C263.728 483.434 263.728 470.566 272.815 467.883L364.175 440.923C417.975 425.048 460.048 382.969 475.923 329.175L502.883 237.815C505.566 228.728 518.434 228.728 521.117 237.815Z"
                fill="currentColor"
            />
        </svg>
    );
}

function hasLocalActiveTurn(state: Pick<ChatTimelineState, 'activeTurn'>) {
    return state.activeTurn !== null;
}

function useOpenChatTabIds() {
    const [openChatIds, setOpenChatIdsState] = React.useState<string[] | null>(() =>
        readOpenChatTabIds()
    );

    const setOpenChatIds = React.useCallback((chatIds: string[]) => {
        const deduped = [...new Set(chatIds)];
        setOpenChatIdsState(deduped);
        writeOpenChatTabIds(deduped);
    }, []);

    React.useEffect(() => {
        const handleChange = () => setOpenChatIdsState(readOpenChatTabIds());

        window.addEventListener(openChatTabsChangedEvent, handleChange);
        window.addEventListener('storage', handleChange);

        return () => {
            window.removeEventListener(openChatTabsChangedEvent, handleChange);
            window.removeEventListener('storage', handleChange);
        };
    }, []);

    return [openChatIds ?? [], setOpenChatIds] as const;
}

function readOpenChatTabIds() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(openChatTabsStorageKey);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as unknown;

        return Array.isArray(parsed)
            ? parsed.filter((chatId): chatId is string => typeof chatId === 'string')
            : [];
    } catch {
        return [];
    }
}

function writeOpenChatTabIds(chatIds: string[]) {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(openChatTabsStorageKey, JSON.stringify(chatIds));
    window.dispatchEvent(new CustomEvent(openChatTabsChangedEvent));
}

function getRouteChatId(pathname: string) {
    const match = pathname.match(/^\/dashboard\/chats\/([^/]+)$/u);
    const chatId = match?.[1] ?? null;

    return chatId && chatId !== 'new' ? chatId : null;
}

function buildPinnedTabStyle(color: string, isActive: boolean): React.CSSProperties {
    if (!isActive) {
        return {};
    }

    return {
        color: `color-mix(in srgb, ${color} 82%, var(--color-black))`,
    };
}

function buildChatTabCloseStyle(color: string | null): React.CSSProperties {
    const closeColor = color
        ? `color-mix(in srgb, ${color} 82%, var(--color-black))`
        : 'var(--topbar-tab-active-foreground)';

    return {
        '--topbar-tab-close': closeColor,
        '--topbar-tab-close-hover': `color-mix(in srgb, ${closeColor} 82%, var(--foreground))`,
    } as React.CSSProperties;
}

function buildPinnedTabIndicatorStyle(color: string): React.CSSProperties {
    return {
        '--topbar-tab-active': `color-mix(in srgb, ${color} 16%, transparent)`,
        '--topbar-tab-active-foreground': `color-mix(in srgb, ${color} 82%, var(--color-black))`,
    } as React.CSSProperties;
}
