import { Plus } from '@hugeicons/core-free-icons';
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
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { useChatCreate } from '../../hooks/chats/use-chat-create.ts';
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
import { ChannelDialog } from '../chats/channel-dialog.tsx';
import { buildChatList, type ChatListItem, getChatAgentId } from '../chats/chat-list-data.ts';
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
// cannot shrink the face back down. The row allows overflow so authored plumes
// and tufts can bleed outside the nominal 20px sidebar icon slot.
const faceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

export function AppSidebarChatList() {
    const location = useLocation();
    const navigate = useNavigate();
    const capability = useCapability();
    const chatQuery = useChatList();
    const agentsQuery = useAgentList();
    const drafts = useChatStartDrafts();
    const createChat = useChatCreate();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [creatingChannel, setCreatingChannel] = React.useState(false);
    const [editingParticipantsChat, setEditingParticipantsChat] =
        React.useState<ChatListItem | null>(null);
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
                            onClick={() => {
                                createChat.reset();
                                setCreatingChannel(true);
                            }}
                            size="icon-xs"
                            title={newChatDisabledReason ?? 'New channel'}
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={Plus} />
                        </Button>
                    </div>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {sidebarChats.channels.map((chat) => (
                                <SidebarRecentChatItem
                                    chat={chat}
                                    isActive={location.pathname === buildChatPath(chat.id)}
                                    key={chat.id}
                                    onArchive={(selectedChat) => {
                                        void archiveSidebarChat(selectedChat);
                                    }}
                                    onCustomizeColor={(selectedChat, color) => {
                                        tabAppearance.reset();
                                        void setChannelColor(selectedChat, color);
                                    }}
                                    onEditParticipants={(selectedChat) => {
                                        updateChat.reset();
                                        setEditingParticipantsChat(selectedChat);
                                    }}
                                    onEditSystemPrompt={(selectedChat) => {
                                        systemPrompt.reset();
                                        setEditingSystemPromptChat(selectedChat);
                                    }}
                                    onRename={openRename}
                                />
                            ))}
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
                            {sidebarChats.directMessages.map((chat) => (
                                <SidebarRecentChatItem
                                    chat={chat}
                                    isActive={location.pathname === buildChatPath(chat.id)}
                                    key={chat.id}
                                    onArchive={(selectedChat) => {
                                        void archiveSidebarChat(selectedChat);
                                    }}
                                    onCustomizeColor={(selectedChat, color) => {
                                        tabAppearance.reset();
                                        void setChannelColor(selectedChat, color);
                                    }}
                                    onEditParticipants={(selectedChat) => {
                                        updateChat.reset();
                                        setEditingParticipantsChat(selectedChat);
                                    }}
                                    onEditSystemPrompt={(selectedChat) => {
                                        systemPrompt.reset();
                                        setEditingSystemPromptChat(selectedChat);
                                    }}
                                    onRename={openRename}
                                />
                            ))}
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
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                errorMessage={createChat.error?.message ?? null}
                initialAgentIds={[]}
                initialDisplayName=""
                isPending={createChat.isPending}
                onClose={() => {
                    if (!createChat.isPending) {
                        createChat.reset();
                        setCreatingChannel(false);
                    }
                }}
                onSubmit={async (input) => {
                    const created = await createChat.mutateAsync(input);
                    setCreatingChannel(false);
                    await navigate(buildChatPath(created.chatId));
                }}
                open={creatingChannel}
                submitLabel="Create"
                title="New channel"
            />
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
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
    onArchive,
    onCustomizeColor,
    onEditSystemPrompt,
    onEditParticipants,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onEditParticipants: (chat: ChatListItem) => void;
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
                onEditParticipants={onEditParticipants}
                onEditSystemPrompt={onEditSystemPrompt}
                onRename={onRename}
            >
                <SidebarMenuButton
                    className="overflow-visible font-normal group-focus-within/menu-item:bg-sidebar-accent group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground"
                    isActive={isActive}
                    render={<NavLink to={path} />}
                    tooltip={title}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-visible">
                        <SidebarChatIcon chat={chat} style={channelColorStyle} />
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        <SidebarChatActivity chat={chat} hidden={hasActiveTurn} />
                        {hasActiveTurn ? (
                            <span aria-hidden="true" className="w-6 shrink-0" />
                        ) : null}
                    </div>
                </SidebarMenuButton>
                <SidebarChatActiveTurnIndicator hidden={!hasActiveTurn} />
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

    const appearance = lookupAppearance(getChatAgentId(chat));

    if (appearance.character !== 'none') {
        return (
            <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center overflow-visible"
            >
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
        <span className="shrink-0 text-sidebar-muted text-xs group-focus-within/menu-item:text-sidebar-accent-foreground/70 group-hover/menu-item:text-sidebar-accent-foreground/70">
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
            className="pointer-events-none absolute top-1/2 right-0.5 z-10 inline-flex size-6 -translate-y-1/2 items-center justify-center text-sidebar-muted group-focus-within/menu-item:text-sidebar-accent-foreground/70 group-hover/menu-item:text-sidebar-accent-foreground/70"
            title="Agent turn in progress"
        >
            <Spinner className="size-4" />
        </span>
    );
}
