import * as React from 'react';

// App-local pane visibility per chat. The tab set itself is Runtime state;
// showing or hiding the pane is presentation, so collapsing never clears
// tabs. No override means auto: visible whenever the chat has tabs.
const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();

export function usePaneVisibilityOverride(chatId: string): boolean | null {
    return React.useSyncExternalStore(
        subscribe,
        () => overrides.get(chatId) ?? null,
        () => null
    );
}

export function setPaneVisibilityOverride(chatId: string, visible: boolean) {
    overrides.set(chatId, visible);
    for (const listener of listeners) {
        listener();
    }
}

export function clearPaneVisibilityOverride(chatId: string) {
    if (!overrides.delete(chatId)) {
        return;
    }
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
