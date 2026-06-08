import * as React from 'react';

const storageKey = 'tavern.chat.thinking-display.enabled';
const listeners = new Set<() => void>();

export function useChatThinkingDisplayPreference() {
    const enabled = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return {
        enabled,
        setEnabled: setChatThinkingDisplayEnabled,
    };
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    if (typeof window === 'undefined') {
        return () => listeners.delete(listener);
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) {
            listener();
        }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}

function getSnapshot() {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.localStorage.getItem(storageKey) === '1';
}

function getServerSnapshot() {
    return false;
}

function setChatThinkingDisplayEnabled(enabled: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(storageKey, enabled ? '1' : '0');

    for (const listener of listeners) {
        listener();
    }
}
