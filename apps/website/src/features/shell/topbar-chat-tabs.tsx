import { Archive02Icon } from '@hugeicons/core-free-icons';
import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import {
    BubbleChatIcon,
    BubbleChatTemporaryIcon,
    MoreHorizontalIcon,
    PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { CloseableTab } from '../../components/ui/closeable-tab.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.tsx';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useChatPin } from '../../hooks/chats/use-chat-pin.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatSystemPrompt } from '../../hooks/chats/use-chat-system-prompt.ts';
import { useChatTabAppearance } from '../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import {
    formatCapabilityDisabledReason,
    newChatCapabilityRequirements,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { routeTabs } from '../../hooks/dashboard/use-route-tab.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { formatTimestamp } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { buildChatList, type ChatListItem } from '../chats/chat-list-data.ts';
import { buildChatPath, buildNewChatDraftPath } from '../chats/chat-path.ts';
import { getPinnedTabColorStyle } from './pinned-tab-options.ts';
import { getRouteTabIcon, getRouteTabIconNode } from './route-tab-presentation.tsx';
import {
    canRenameSidebarChat,
    getErrorMessage,
    SidebarChatContextMenu,
    SidebarChatRenameDialog,
    SidebarChatSystemPromptDialog,
} from './sidebar-chat-actions.tsx';
import {
    buildSidebarChatGroups,
    formatSidebarActivityLabel,
    getSidebarDraftActivityLabel,
} from './sidebar-chat-list-model.ts';

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
    const capability = useCapability();
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const pinChat = useChatPin();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [editingSystemPromptChat, setEditingSystemPromptChat] =
        React.useState<ChatListItem | null>(null);
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
            <div className="flex min-w-0 flex-1 items-center gap-1">
                <TabsSubtle
                    aria-label="Primary"
                    className="scrollbar-hidden min-w-0 max-w-full shrink overflow-x-auto overscroll-x-contain"
                    onValueChange={(value) => {
                        const routeTab = parseRouteTabValue(value);

                        if (routeTab) {
                            if (!capability(routeTabCapabilityRequirements[routeTab]).healthy) {
                                setSelectedTabValue(activeTabValue ?? '');
                                return;
                            }

                            setSelectedTabValue(value);
                            onSelectRouteTab(routeTab);
                            return;
                        }

                        const draftId = parseDraftTabValue(value);

                        if (draftId) {
                            setSelectedTabValue(value);
                            const draft = draftChats.find((entry) => entry.id === draftId);

                            if (draft) {
                                void navigate(getTopbarDraftPath(draft), {
                                    state: { draftChatId: draft.id },
                                });
                            }

                            return;
                        }

                        if (getSelectedChat(value, topbarChats.allChats)) {
                            setSelectedTabValue(value);
                            void navigate(buildChatPath(value));
                        }
                    }}
                    value={selectedTabValue}
                >
                    <TabsSubtleList className="gap-1 overflow-visible">
                        {routeTabs.map((tab) => (
                            <TopbarRouteTab key={tab.id} tab={tab.id} />
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
                                    archiveChat.isPending &&
                                    archiveChat.variables?.chatId === chat.id
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
                                onEditSystemPrompt={(selectedChat) => {
                                    systemPrompt.reset();
                                    setEditingSystemPromptChat(selectedChat);
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
                                <TopbarDraftChatTab
                                    draft={draft}
                                    isActive={isActive}
                                    key={draft.id}
                                />
                            );
                        })}
                        {visibleRecentChats.map((chat) => (
                            <TopbarRecentChatTab
                                chat={chat}
                                isActive={location.pathname === buildChatPath(chat.id)}
                                isArchivePending={
                                    archiveChat.isPending &&
                                    archiveChat.variables?.chatId === chat.id
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
                                onEditSystemPrompt={(selectedChat) => {
                                    systemPrompt.reset();
                                    setEditingSystemPromptChat(selectedChat);
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
                <TopbarNewChatButton />
            </div>
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
                        size="icon-sm"
                        title="All chats"
                        variant="ghost"
                    />
                }
            >
                <Icon aria-hidden="true" className="size-5.5" icon={MoreHorizontalIcon} size={22} />
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
    const capability = useCapability();
    const gate = capability(newChatCapabilityRequirements);
    const disabledReason = gate.healthy ? null : formatCapabilityDisabledReason(gate);

    return (
        <Button
            aria-label="New chat"
            className="no-drag text-muted-foreground/70 hover:text-foreground data-pressed:text-foreground [&_svg]:opacity-70 hover:[&_svg]:opacity-90"
            disabled={!gate.healthy}
            render={gate.healthy ? <NavLink to="/dashboard/overview" /> : undefined}
            size="icon-sm"
            title={disabledReason ?? 'New chat'}
            variant="ghost"
        >
            <Icon aria-hidden="true" className="size-4" icon={PlusSignIcon} size={16} />
        </Button>
    );
}

function TopbarRouteTab({ tab }: { tab: RouteTab }) {
    const capability = useCapability();
    const gate = capability(routeTabCapabilityRequirements[tab]);
    const disabledReason = gate.healthy ? null : formatCapabilityDisabledReason(gate);
    const item = (
        <TabsSubtleItem
            disabled={!gate.healthy}
            icon={getRouteTabIcon(tab)}
            iconNode={getRouteTabIconNode(tab)}
            label={routeTabs.find((entry) => entry.id === tab)?.label ?? tab}
            value={getRouteTabValue(tab)}
        />
    );

    if (!disabledReason) {
        return item;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{item}</TooltipTrigger>
            <TooltipContent side="bottom">{disabledReason}</TooltipContent>
        </Tooltip>
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
    onEditSystemPrompt,
    onPinChange,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    isArchivePending: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCloseTab: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onEditSystemPrompt: (chat: ChatListItem) => void;
    onPinChange: (chat: ChatListItem, pinned: boolean) => void;
    onRename: (chat: ChatListItem) => void;
}) {
    const title = resolveTavernChatName(chat);
    const timelineState = useChatRuntimeTimelineState(chat.id);
    const hasActiveTurn = chat.hasActiveTurn || hasLocalActiveTurn(timelineState);
    const tabColor = chat.isPinned ? chat.tabAppearance.color : null;
    const pinnedTabColorStyle = getPinnedTabColorStyle(tabColor);
    const canClose = !(chat.isPinned || hasActiveTurn);

    return (
        <SidebarChatContextMenu
            chat={chat}
            onArchive={onArchive}
            onCloseTab={onCloseTab}
            onCustomizeColor={onCustomizeColor}
            onEditSystemPrompt={onEditSystemPrompt}
            onPinChange={onPinChange}
            onRename={onRename}
            triggerClassName="no-drag h-7 shrink-0 overflow-hidden"
        >
            <CloseableTab
                className="h-7"
                closeable={canClose}
                closeLabel={`Close ${title}`}
                closeSide="left"
                onClose={() => onCloseTab(chat)}
            >
                <TabsSubtleItem
                    aria-current={isActive ? 'page' : undefined}
                    className={topbarChatTabButtonClassName({
                        hasPinnedColor: Boolean(pinnedTabColorStyle),
                        isActive,
                    })}
                    iconNode={
                        <TopbarChatTabIcon
                            className={canClose ? 'group-hover/tab:opacity-0' : null}
                            color={tabColor}
                            isActiveTurn={hasActiveTurn}
                            isPinned={chat.isPinned}
                        />
                    }
                    label={title}
                    style={pinnedTabColorStyle}
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
            </CloseableTab>
        </SidebarChatContextMenu>
    );
}

function TopbarChatTabIcon({
    className,
    color,
    isActiveTurn,
    isPinned = false,
}: {
    className?: string | null;
    color?: string | null;
    isActiveTurn: boolean;
    isPinned?: boolean;
}) {
    if (isActiveTurn) {
        return <Spinner className={cn('size-4 shrink-0', className)} />;
    }

    return (
        <Icon
            aria-hidden="true"
            className={cn(
                'size-4 shrink-0',
                isPinned ? '-mr-0.5' : null,
                isPinned && color
                    ? 'text-[var(--pinned-tab-color-light)] dark:text-[var(--pinned-tab-color-dark)]'
                    : null,
                className
            )}
            icon={isPinned ? HashtagIcon : BubbleChatTemporaryIcon}
            size={16}
            style={getTopbarChatTabIconStyle({ isPinned })}
        />
    );
}

function getTopbarChatTabIconStyle({ isPinned }: { isPinned: boolean }) {
    if (!isPinned) {
        return undefined;
    }

    return {
        stroke: 'currentColor',
        strokeWidth: 0.6,
    } as React.CSSProperties;
}

function topbarChatTabButtonClassName({
    hasPinnedColor = false,
    isActive,
    tone = 'default',
}: {
    hasPinnedColor?: boolean;
    isActive: boolean;
    tone?: 'default' | 'error';
}) {
    return cn(
        'no-drag h-7 w-fit max-w-[180px] justify-start overflow-hidden rounded-full px-2 [&_svg]:opacity-70',
        getTopbarChatTabTextClassName({ isActive }),
        hasPinnedColor
            ? 'before:bg-[var(--pinned-tab-bg-light)] before:opacity-100 hover:before:bg-[var(--pinned-tab-bg-hover-light)] data-active:before:bg-[var(--pinned-tab-bg-active-light)] dark:before:bg-[var(--pinned-tab-bg-dark)] dark:data-active:before:bg-[var(--pinned-tab-bg-active-dark)] dark:hover:before:bg-[var(--pinned-tab-bg-hover-dark)]'
            : null,
        tone === 'error' ? 'text-error-foreground hover:text-error-foreground' : null
    );
}

function getTopbarChatTabTextClassName({ isActive }: { isActive: boolean }) {
    return isActive ? 'text-primary hover:bg-transparent' : 'text-primary hover:text-primary';
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
