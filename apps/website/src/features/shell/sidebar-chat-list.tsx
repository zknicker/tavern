import { Archive02Icon, Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
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
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatSystemPrompt } from '../../hooks/chats/use-chat-system-prompt.ts';
import { useChatTabAppearance } from '../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import {
    formatCapabilityDisabledReason,
    newChatCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { buildChatList, type ChatListItem } from '../chats/chat-list-data.ts';
import { buildChatPath } from '../chats/chat-path.ts';
import { getChannelColorStyle } from './channel-color-options.ts';
import {
    canRenameSidebarChat,
    getErrorMessage,
    SidebarChatContextMenu,
    SidebarChatRenameDialog,
    SidebarChatSystemPromptDialog,
} from './sidebar-chat-actions.tsx';
import {
    buildSidebarChatGroups,
    buildSidebarDraftChatList,
    formatSidebarActivityLabel,
    getSidebarChatTitle,
    getSidebarDraftActivityLabel,
    getSidebarDraftPath,
    hasLocalActiveTurn,
} from './sidebar-chat-list-model.ts';

// Inline width/height so the sidebar menu button's `[&_svg]:size-4.5` rule
// cannot shrink the face back down. 24 is a natural divisor of the 480px art
// frame (480/24 = 20) and slightly overhangs the 20px slot so the face sits
// optically level with the hash boxes.
const faceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

export function AppSidebarChatList() {
    const location = useLocation();
    const navigate = useNavigate();
    const capability = useCapability();
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [editingSystemPromptChat, setEditingSystemPromptChat] =
        React.useState<ChatListItem | null>(null);
    const sidebarChats = React.useMemo(
        () => buildSidebarChatGroups(buildChatList(chatQuery.data)),
        [chatQuery.data]
    );
    const draftChats = React.useMemo(
        () => buildSidebarDraftChatList(drafts.listDrafts(), sidebarChats.allChats),
        [drafts, sidebarChats.allChats]
    );
    const activeDraftRoute = getChatDraftRouteState(location.state);
    const newChatGate = capability(newChatCapabilityRequirements);
    const newChatDisabledReason = newChatGate.healthy
        ? null
        : formatCapabilityDisabledReason(newChatGate);

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
                    await navigate(appRoutes.overview);
                }
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep sidebar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [archiveChat, location.pathname, navigate]
    );
    const setChannelColor = React.useCallback(
        async (chat: ChatListItem, color: string | null) => {
            try {
                await tabAppearance.mutateAsync({
                    chatId: chat.id,
                    color,
                });
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep sidebar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [tabAppearance]
    );

    return (
        <>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                <SidebarGroup className="group/channels pt-1">
                    <div className="relative flex h-8 items-center px-2">
                        <div className="font-medium text-[var(--nav-section-label)] text-sm">
                            Channels
                        </div>
                        <Button
                            aria-label="New channel"
                            className="absolute top-1/2 right-[0.0625rem] -translate-y-1/2 opacity-0 group-focus-within/channels:opacity-100 group-hover/channels:opacity-100 [&_svg]:size-[1.0625rem]"
                            disabled={!newChatGate.healthy}
                            render={
                                newChatGate.healthy ? (
                                    <NavLink to={appRoutes.overview} />
                                ) : undefined
                            }
                            size="icon-xs"
                            title={newChatDisabledReason ?? 'New channel'}
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={Plus} />
                        </Button>
                    </div>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {sidebarChats.channels.map((chat) => {
                                const isArchivePending =
                                    archiveChat.isPending &&
                                    archiveChat.variables?.chatId === chat.id;

                                return (
                                    <SidebarRecentChatItem
                                        chat={chat}
                                        isActive={location.pathname === buildChatPath(chat.id)}
                                        isArchivePending={isArchivePending}
                                        key={chat.id}
                                        onArchive={(selectedChat) => {
                                            void archiveSidebarChat(selectedChat);
                                        }}
                                        onCustomizeColor={(selectedChat, color) => {
                                            tabAppearance.reset();
                                            void setChannelColor(selectedChat, color);
                                        }}
                                        onEditSystemPrompt={(selectedChat) => {
                                            systemPrompt.reset();
                                            setEditingSystemPromptChat(selectedChat);
                                        }}
                                        onRename={openRename}
                                    />
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup className="group/dms pt-1">
                    <div className="relative flex h-8 items-center px-2">
                        <div className="font-medium text-[var(--nav-section-label)] text-sm">
                            Direct messages
                        </div>
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
                            {sidebarChats.directMessages.map((chat) => {
                                const isArchivePending =
                                    archiveChat.isPending &&
                                    archiveChat.variables?.chatId === chat.id;

                                return (
                                    <SidebarRecentChatItem
                                        chat={chat}
                                        isActive={location.pathname === buildChatPath(chat.id)}
                                        isArchivePending={isArchivePending}
                                        key={chat.id}
                                        onArchive={(selectedChat) => {
                                            void archiveSidebarChat(selectedChat);
                                        }}
                                        onCustomizeColor={(selectedChat, color) => {
                                            tabAppearance.reset();
                                            void setChannelColor(selectedChat, color);
                                        }}
                                        onEditSystemPrompt={(selectedChat) => {
                                            systemPrompt.reset();
                                            setEditingSystemPromptChat(selectedChat);
                                        }}
                                        onRename={openRename}
                                    />
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
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
    onArchive,
    onCustomizeColor,
    onEditSystemPrompt,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    isArchivePending: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onEditSystemPrompt: (chat: ChatListItem) => void;
    onRename: (chat: ChatListItem) => void;
}) {
    const title = getSidebarChatTitle(chat);
    const path = buildChatPath(chat.id);
    const timelineState = useChatRuntimeTimelineState(chat.id);
    const hasActiveTurn = chat.hasActiveTurn || hasLocalActiveTurn(timelineState);
    const channelColorStyle = getChannelColorStyle(chat.tabAppearance.color);

    return (
        <SidebarMenuItem>
            <SidebarChatContextMenu
                chat={chat}
                onArchive={onArchive}
                onCustomizeColor={onCustomizeColor}
                onEditSystemPrompt={onEditSystemPrompt}
                onRename={onRename}
            >
                <SidebarMenuButton
                    className="font-normal group-focus-within/menu-item:bg-sidebar-accent group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground"
                    isActive={isActive}
                    render={<NavLink to={path} />}
                    tooltip={title}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <SidebarChatIcon chat={chat} style={channelColorStyle} />
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        <SidebarChatActivity chat={chat} hidden={hasActiveTurn} />
                        {hasActiveTurn && !isArchivePending ? (
                            <span aria-hidden="true" className="w-6 shrink-0" />
                        ) : null}
                    </span>
                </SidebarMenuButton>
                <SidebarChatActiveTurnIndicator hidden={isArchivePending || !hasActiveTurn} />
                <SidebarChatArchiveAction
                    isPending={isArchivePending}
                    onArchive={() => onArchive(chat)}
                />
            </SidebarChatContextMenu>
        </SidebarMenuItem>
    );
}

function SidebarChatIcon({
    chat,
    style,
}: {
    chat: ChatListItem;
    style: React.CSSProperties | undefined;
}) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';

    if (chat.conversationKind === 'channel') {
        return <ChannelIconBox size="sidebar" style={style} />;
    }

    const appearance = lookupAppearance(getSidebarChatAgentId(chat));

    if (appearance.character !== 'none') {
        return (
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={appearance.character}
                    ink={resolveAgentInk(dark, appearance.primaryColor)}
                    size={24}
                    style={faceStyle}
                />
            </span>
        );
    }

    return (
        <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-[0.4375rem] bg-sidebar-accent font-medium text-[0.625rem] text-sidebar-muted"
        >
            {getSidebarParticipantInitial(chat)}
        </span>
    );
}

function getSidebarChatAgentId(chat: ChatListItem) {
    return (
        chat.participants.find((participant) => participant.actorType === 'agent')?.actorId ??
        chat.boundAgentIds[0] ??
        null
    );
}

function getSidebarParticipantInitial(chat: ChatListItem) {
    const name = chat.targetParticipant?.name ?? chat.participants[0]?.name ?? chat.title;
    const normalized = name.trim();

    return (normalized[0] ?? '?').toUpperCase();
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
    isPending,
    onArchive,
}: {
    isPending: boolean;
    onArchive: () => void;
}) {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (isPending) {
            return;
        }

        onArchive();
    };

    const controlClassName =
        'absolute top-1/2 right-0.5 z-10 size-6 -translate-y-1/2 border-transparent bg-transparent text-sidebar-muted opacity-0 shadow-none hover:bg-transparent hover:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-pressed:bg-transparent sm:size-6 [&_svg]:size-4 [&_svg]:opacity-100';

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
