import * as React from 'react';
import { setChatSidePane } from '../pane/use-chat-side-pane.ts';

export interface ThreadPaneState {
    anchorMessageId: string;
    threadChatId: string | null;
}

const panes = new Map<string, ThreadPaneState>();
const listeners = new Set<() => void>();

export function useThreadPane(chatId: string) {
    return React.useSyncExternalStore(
        subscribe,
        () => getThreadPane(chatId),
        () => null
    );
}

export function getThreadPane(chatId: string): ThreadPaneState | null {
    return panes.get(chatId) ?? null;
}

export function openThreadPane(chatId: string, state: ThreadPaneState) {
    panes.set(chatId, state);
    setChatSidePane(chatId, 'thread');
    emitChange();
}

export function closeThreadPane(chatId: string) {
    panes.delete(chatId);
    setChatSidePane(chatId, 'artifact');
    emitChange();
}

export function setThreadPaneChatId(chatId: string, anchorMessageId: string, threadChatId: string) {
    const current = panes.get(chatId);

    // A first-reply completion for another anchor (the user switched threads
    // mid-flight) must not attach its thread id to the pane's current anchor.
    if (
        !current ||
        current.anchorMessageId !== anchorMessageId ||
        current.threadChatId === threadChatId
    ) {
        return;
    }

    panes.set(chatId, { ...current, threadChatId });
    emitChange();
}

export function resetThreadPanesForTest() {
    panes.clear();
    emitChange();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}
