import { Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import { resolveTavernChatName } from '../../../components/chats/chat-display.ts';
import { TavernLogo } from '../../../components/tavern-logo.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import type { RouteTab } from '../../../hooks/shell/use-route-tab.ts';
import { getRouteTab, routeTabs } from '../../../hooks/shell/use-route-tab.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { type ChatListItem, getChatAgentId } from '../../chats/chat-list-data.ts';
import { getRouteTabIcon, getRouteTabIconNode } from '../route-tab-presentation.tsx';
import { getRouteChatId, getRouteNewTabKey } from './chat-tabs-model.ts';
import { TavernTabFavicon } from './tavern-tab-favicon.tsx';

export type RouteTabKind = 'chat' | 'draft' | 'home' | 'section';

export interface RouteDescriptor {
    chatId?: string;
    kind: RouteTabKind;
    section?: RouteTab | 'settings';
    title: string;
}

/** Maps a tab's route to what its tab should show — title, kind, and (for chats) the id. */
export function describeRoute(route: string, chatById: Map<string, ChatListItem>): RouteDescriptor {
    const path = route.split('?')[0].split('#')[0];
    const chatId = getRouteChatId(path);

    if (chatId) {
        const chat = chatById.get(chatId);
        return { kind: 'chat', chatId, title: chat ? resolveTavernChatName(chat) : 'Chat' };
    }

    if (path === appRoutes.newChatDraft) {
        return { kind: 'draft', title: 'New chat' };
    }

    if (getRouteNewTabKey(path)) {
        return { kind: 'home', title: 'New tab' };
    }

    if (path.startsWith(appRoutes.settings)) {
        return { kind: 'section', section: 'settings', title: 'Settings' };
    }

    const section = getRouteTab(path);

    if (section) {
        const title =
            section === 'overview'
                ? 'Tavern'
                : (routeTabs.find((tab) => tab.id === section)?.label ?? section);
        return { kind: 'section', section, title };
    }

    return { kind: 'section', section: 'overview', title: 'Tavern' };
}

/** Renders the favicon for a tab given its route descriptor and live chat state. */
export function renderRouteFavicon(
    descriptor: RouteDescriptor,
    chatById: Map<string, ChatListItem>,
    busy: boolean
): ReactNode {
    if (descriptor.kind === 'chat') {
        const chat = descriptor.chatId ? chatById.get(descriptor.chatId) : undefined;
        return (
            <TavernTabFavicon
                agentId={chat ? getChatAgentId(chat) : null}
                busy={busy}
                color={chat?.tabAppearance.color ?? null}
                isChannel={chat?.conversationKind === 'channel'}
            />
        );
    }

    if (descriptor.kind === 'draft') {
        return <TavernTabFavicon busy={busy} />;
    }

    if (descriptor.section === 'settings') {
        return (
            <Icon aria-hidden="true" className="size-4 shrink-0 opacity-80" icon={Setting07Icon} />
        );
    }

    if (descriptor.section && descriptor.section !== 'overview') {
        const icon = getRouteTabIcon(descriptor.section);

        if (icon) {
            return <Icon aria-hidden="true" className="size-4 shrink-0 opacity-80" icon={icon} />;
        }

        return getRouteTabIconNode(descriptor.section, 'size-4 shrink-0 opacity-80');
    }

    // Home + the Tavern overview share the logo.
    return <TavernLogo aria-hidden="true" className="size-4 shrink-0 opacity-80" />;
}
