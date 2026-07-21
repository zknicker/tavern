import * as React from 'react';
import { getChatSidePane, setChatSidePane } from './use-chat-side-pane.ts';

// Right-pane arbitration contract, shared with the upcoming thread pane (WS3):
// one pane is visible per chat, and the most recent opener wins.
export function createAgentProfilePaneStore() {
    const profiles = new Map<string, string>();
    const listeners = new Set<() => void>();

    return {
        close(chatId: string) {
            if (!profiles.delete(chatId)) {
                return;
            }
            notify(listeners);
        },
        get(chatId: string) {
            return profiles.get(chatId) ?? null;
        },
        open(chatId: string, agentId: string) {
            profiles.set(chatId, agentId);
            notify(listeners);
        },
        reset() {
            profiles.clear();
            notify(listeners);
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

const store = createAgentProfilePaneStore();

export function openAgentProfilePane(chatId: string, agentId: string) {
    store.open(chatId, agentId);
    setChatSidePane(chatId, 'profile');
}

export function closeAgentProfilePane(chatId: string) {
    store.close(chatId);
    if (getChatSidePane(chatId) === 'profile') {
        setChatSidePane(chatId, 'artifact');
    }
}

export function useAgentProfilePane(chatId: string): string | null {
    return React.useSyncExternalStore(
        store.subscribe,
        () => store.get(chatId),
        () => null
    );
}

export function resetAgentProfilePanesForTest() {
    store.reset();
}

function notify(listeners: Set<() => void>) {
    for (const listener of listeners) {
        listener();
    }
}
