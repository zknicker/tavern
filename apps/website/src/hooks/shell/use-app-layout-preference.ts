import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

export type AppLayoutMode = 'tabs' | 'sidebar';

const storageKey = 'tavern.app.layout.mode.v2';
const defaultMode: AppLayoutMode = 'tabs';
const listeners = new Set<() => void>();

export function useAppLayoutPreference() {
    const mode = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return {
        mode,
        setMode: setAppLayoutMode,
    };
}

export function useAppLayoutSearchParam() {
    const [searchParams] = useSearchParams();
    const requestedMode = parseAppLayoutMode(searchParams.get('layout'));

    React.useEffect(() => {
        if (requestedMode) {
            setAppLayoutMode(requestedMode);
        }
    }, [requestedMode]);
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
    return getAppLayoutModeSnapshot();
}

export function getAppLayoutModeSnapshot() {
    if (typeof window === 'undefined') {
        return defaultMode;
    }

    return parseAppLayoutMode(window.localStorage.getItem(storageKey)) ?? defaultMode;
}

function getServerSnapshot() {
    return defaultMode;
}

function setAppLayoutMode(mode: AppLayoutMode) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(storageKey, mode);

    for (const listener of listeners) {
        listener();
    }
}

function parseAppLayoutMode(value: string | null): AppLayoutMode | null {
    if (value === 'tabs' || value === 'sidebar') {
        return value;
    }

    return null;
}
