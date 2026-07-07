import * as React from 'react';
import type { ChatTimelineState } from '../../../hooks/chats/chat-timeline-state.ts';
import type { ChatStartDraft } from '../../../hooks/chats/use-chat-start-drafts.tsx';
import { formatTimestamp } from '../../../lib/format.ts';
import { type ChatListItem, getChatLastActivityLabel } from '../../chats/chat-list-data.ts';
import { buildChatPath, buildNewChatDraftPath } from '../../chats/chat-path.ts';

export const openChatTabsStorageKey = 'tavern.chatTabs.openChatIds.v1';
export const newTabKeysStorageKey = 'tavern.chatTabs.newTabKeys.v1';
export const openChatTabsChangedEvent = 'tavern:open-chat-tabs-changed';

const draftTabPrefix = 'draft:';
const newTabPrefix = 'new:';

/* ----------------------------------------------------------- per-window order */
/* Open chat tabs and blank "new tab" pages are per-window state (sessionStorage
   is scoped per window context), so each window owns its own tab set. */

export function useOpenChatTabIds() {
    return useSessionStringList(openChatTabsStorageKey);
}

export function useNewTabKeys() {
    return useSessionStringList(newTabKeysStorageKey);
}

function useSessionStringList(storageKey: string) {
    const [value, setValue] = React.useState<string[] | null>(() => readStringList(storageKey));

    const setList = React.useCallback(
        (items: string[]) => {
            const deduped = [...new Set(items)];
            setValue(deduped);
            writeStringList(storageKey, deduped);
        },
        [storageKey]
    );

    React.useEffect(() => {
        const handleChange = () => setValue(readStringList(storageKey));

        window.addEventListener(openChatTabsChangedEvent, handleChange);
        window.addEventListener('storage', handleChange);

        return () => {
            window.removeEventListener(openChatTabsChangedEvent, handleChange);
            window.removeEventListener('storage', handleChange);
        };
    }, [storageKey]);

    return [value ?? [], setList] as const;
}

function readStringList(storageKey: string) {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(storageKey);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as unknown;

        return Array.isArray(parsed)
            ? parsed.filter((entry): entry is string => typeof entry === 'string')
            : [];
    } catch {
        return [];
    }
}

function writeStringList(storageKey: string, items: string[]) {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(openChatTabsChangedEvent));
}

/** Drop a blank "new tab" when a chat is started from it (consumed in place). */
export function consumeNewTabForRoute(pathname: string) {
    const key = getRouteNewTabKey(pathname);

    if (!key) {
        return;
    }

    writeStringList(
        newTabKeysStorageKey,
        (readStringList(newTabKeysStorageKey) ?? []).filter((entry) => entry !== key)
    );
}

/* ----------------------------------------------------------------- routing */

export function buildNewTabPath(key: string) {
    return `/new/${key}`;
}

export function getRouteNewTabKey(pathname: string) {
    return pathname.match(/^\/new\/([^/]+)$/u)?.[1] ?? null;
}

export function getNewTabValue(key: string) {
    return `${newTabPrefix}${key}`;
}

export function parseNewTabValue(value: string) {
    return value.startsWith(newTabPrefix) ? value.slice(newTabPrefix.length) : null;
}

export function getRouteChatId(pathname: string) {
    const match = pathname.match(/^\/chats\/([^/]+)$/u);
    const chatId = match?.[1] ?? null;

    return chatId && chatId !== 'new' ? chatId : null;
}

/** The app route a tab points at, for seeding a detached window. Drafts can't move. */
export function routeForTab(tabId: string): string | null {
    const newTabKey = parseNewTabValue(tabId);

    if (newTabKey) {
        return buildNewTabPath(newTabKey);
    }

    if (parseDraftTabValue(tabId)) {
        return null;
    }

    return buildChatPath(tabId);
}

/* ---------------------------------------------------------------- ordering */

export function sortChatsByCreatedAt(chats: ChatListItem[]) {
    return [...chats].sort(
        (left, right) =>
            compareCreatedAt(left.createdAt, right.createdAt) ||
            left.title.localeCompare(right.title)
    );
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

export function formatTopbarChatActivityTitle(chat: ChatListItem) {
    return chat.lastActivityAt
        ? formatTimestamp(chat.lastActivityAt)
        : getChatLastActivityLabel(chat);
}

/* ------------------------------------------------------------------ drafts */

export function buildTopbarDraftChatList(drafts: ChatStartDraft[], chats: ChatListItem[]) {
    const syncedChatIds = new Set(chats.map((chat) => chat.id));

    return drafts
        .filter((draft) => !(draft.realChatId && syncedChatIds.has(draft.realChatId)))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function getTopbarDraftPath(draft: ChatStartDraft) {
    return draft.realChatId ? buildChatPath(draft.realChatId) : buildNewChatDraftPath();
}

export function getDraftTabValue(draftChatId: string) {
    return `${draftTabPrefix}${draftChatId}`;
}

export function parseDraftTabValue(value: string) {
    return value.startsWith(draftTabPrefix) ? value.slice(draftTabPrefix.length) : null;
}

export function hasLocalActiveTurn(state: Pick<ChatTimelineState, 'activeTurn'>) {
    return state.activeTurn !== null;
}

export function isDraftActiveTurn(
    draft: ChatStartDraft,
    timelineState: Pick<ChatTimelineState, 'activeTurn'>
) {
    return (
        draft.status === 'queued' ||
        draft.status === 'creating' ||
        (draft.status === 'reconciled' && hasLocalActiveTurn(timelineState))
    );
}
