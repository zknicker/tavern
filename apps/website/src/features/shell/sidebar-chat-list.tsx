import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
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

export function AppSidebarChatList() {
    const location = useLocation();
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const recentChats = React.useMemo(
        () => buildSidebarChatList(buildChatList(chatQuery.data?.chats ?? [])),
        [chatQuery.data?.chats]
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

    return (
        <>
            <SidebarGroup className="pt-1">
                <SidebarGroupLabel>Chats</SidebarGroupLabel>
                <SidebarGroupAction
                    aria-label="New chat"
                    render={<NavLink to="/dashboard/chats" />}
                    title="New chat"
                >
                    <Icon aria-hidden="true" icon={Plus} />
                </SidebarGroupAction>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {draftChats.map((draft) => {
                            const path = getSidebarDraftPath(draft);
                            const title = draft.title;
                            const isActive =
                                activeDraftRoute?.draftChatId === draft.id ||
                                (draft.realChatId !== null &&
                                    location.pathname === buildChatPath(draft.realChatId));

                            return (
                                <SidebarMenuItem key={draft.id}>
                                    <SidebarMenuButton
                                        className="font-normal"
                                        isActive={isActive}
                                        render={
                                            <NavLink state={{ draftChatId: draft.id }} to={path} />
                                        }
                                        tooltip={title}
                                    >
                                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                            <span className="min-w-0 truncate">{title}</span>
                                            <span className="shrink-0 text-sidebar-muted text-xs">
                                                {getSidebarDraftActivityLabel(draft)}
                                            </span>
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                        {visibleRecentChats.map((chat) => {
                            const path = buildChatPath(chat.id);
                            const isActive = location.pathname === path;
                            const title = getSidebarChatTitle(chat);

                            return (
                                <SidebarMenuItem key={chat.id}>
                                    <SidebarChatContextMenu
                                        chat={chat}
                                        onArchive={(selectedChat) => {
                                            void archiveSidebarChat(selectedChat);
                                        }}
                                        onRename={openRename}
                                    >
                                        <SidebarMenuButton
                                            className="font-normal"
                                            isActive={isActive}
                                            render={<NavLink to={path} />}
                                            tooltip={title}
                                        >
                                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                                <span className="min-w-0 truncate">{title}</span>
                                                <span className="shrink-0 text-sidebar-muted text-xs">
                                                    {chat.lastActivityLabel}
                                                </span>
                                            </span>
                                        </SidebarMenuButton>
                                    </SidebarChatContextMenu>
                                </SidebarMenuItem>
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
