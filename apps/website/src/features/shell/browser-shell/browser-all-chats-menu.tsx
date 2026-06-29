import {
    BubbleChatIcon,
    BubbleChatTemporaryIcon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../../components/chats/chat-display.ts';
import { Icon } from '../../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useChatList } from '../../../hooks/chats/use-chat-list.ts';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import { buildChatList } from '../../chats/chat-list-data.ts';
import { buildChatPath } from '../../chats/chat-path.ts';
import { buildSidebarChatGroups, formatSidebarActivityLabel } from '../sidebar-chat-list.tsx';
import { formatTopbarChatActivityTitle, sortChatsByCreatedAt } from './chat-tabs-model.ts';

/** The right-cluster "all chats" menu — navigates the active tab to any chat. */
export function BrowserAllChatsMenu() {
    const navigate = useNavigate();
    const chatQuery = useChatList();
    const chats = React.useMemo(
        () => sortChatsByCreatedAt(buildSidebarChatGroups(buildChatList(chatQuery.data)).allChats),
        [chatQuery.data]
    );

    const openChat = React.useCallback(
        async (chat: ChatListItem) => {
            await navigate(buildChatPath(chat.id));
        },
        [navigate]
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
                            onClick={() => void openChat(chat)}
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
