import type { ReactNode } from 'react';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import { getChannelColorStyle } from '../channel-color-options.ts';
import { SidebarChatContextMenu } from '../sidebar-chat-actions.tsx';
import { describeRoute, renderRouteFavicon } from './describe-route.tsx';
import type { TabItem, TabsMeta } from './types.ts';

interface TabRendererHandlers {
    onArchive: (chat: ChatListItem) => void;
    onCloseTab: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onEditSystemPrompt: (chat: ChatListItem) => void;
    onOpenInNewWindow?: (chat: ChatListItem) => void;
    onRename: (chat: ChatListItem) => void;
}

/**
 * The presentation slots the shell injects per tab: a favicon (Tavern logo for blank
 * tabs, spinner/pinned/temporary for chats), pinned color style, and the chat context
 * menu wrapper. Kept out of the state provider so it stays focused on tab state.
 */
export function buildTavernTabRenderers(
    chatById: Map<string, ChatListItem>,
    handlers: TabRendererHandlers
): Pick<TabsMeta, 'renderFavicon' | 'renderTabWrapper' | 'tabStyle'> {
    return {
        renderFavicon: (tab: TabItem) =>
            renderRouteFavicon(
                describeRoute(tab.route ?? '', chatById),
                chatById,
                tab.busy ?? false
            ),
        tabStyle: (tab: TabItem) => {
            const chat = chatForTab(tab, chatById);

            return getChannelColorStyle(chat?.tabAppearance.color ?? null);
        },
        renderTabWrapper: (tab: TabItem, node: ReactNode) => {
            const chat = chatForTab(tab, chatById);

            if (!chat) {
                return node;
            }

            return (
                <SidebarChatContextMenu
                    chat={chat}
                    onArchive={handlers.onArchive}
                    onCloseTab={handlers.onCloseTab}
                    onCustomizeColor={handlers.onCustomizeColor}
                    onEditSystemPrompt={handlers.onEditSystemPrompt}
                    onOpenInNewWindow={handlers.onOpenInNewWindow}
                    onRename={handlers.onRename}
                    triggerClassName="flex items-end"
                >
                    {node}
                </SidebarChatContextMenu>
            );
        },
    };
}

/** The chat backing a tab, derived from its route (or undefined for non-chat tabs). */
function chatForTab(tab: TabItem, chatById: Map<string, ChatListItem>): ChatListItem | undefined {
    const { chatId } = describeRoute(tab.route ?? '', chatById);
    return chatId ? chatById.get(chatId) : undefined;
}
