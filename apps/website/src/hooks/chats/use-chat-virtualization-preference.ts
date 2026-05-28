import * as React from 'react';

const storageKey = 'tavern.chat.virtualization.enabled';
const listeners = new Set<() => void>();

export function useChatVirtualizationPreference() {
    const enabled = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return {
        enabled,
        setEnabled: setChatVirtualizationEnabled,
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
        return true;
    }

    return window.localStorage.getItem(storageKey) !== '0';
}

function getServerSnapshot() {
    return true;
}

function setChatVirtualizationEnabled(enabled: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(storageKey, enabled ? '1' : '0');

    for (const listener of listeners) {
        listener();
    }
}
