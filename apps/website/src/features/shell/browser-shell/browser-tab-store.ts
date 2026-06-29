import * as React from 'react';

/** A browser-style tab: a stable id plus the route it currently shows. */
export interface BrowserTab {
    id: string;
    route: string;
}

export interface BrowserTabsState {
    activeId: string | null;
    tabs: BrowserTab[];
}

const tabsStorageKey = 'tavern.browserTabs.v1';
const activeStorageKey = 'tavern.browserTabs.active.v1';

/**
 * Per-window tab state ({@link BrowserTab}s + the active id), persisted in sessionStorage
 * so each window owns its own tabs. `apply` is a pure functional update; persistence runs
 * as an effect so updates stay side-effect-free (no re-entrancy from native event handlers).
 */
export function useBrowserTabs(): readonly [
    BrowserTabsState,
    (next: (current: BrowserTabsState) => BrowserTabsState) => void,
] {
    const [state, setState] = React.useState<BrowserTabsState>(read);
    const apply = React.useCallback(
        (next: (current: BrowserTabsState) => BrowserTabsState) => setState(next),
        []
    );

    React.useEffect(() => {
        write(state);
    }, [state]);

    return [state, apply] as const;
}

function read(): BrowserTabsState {
    if (typeof window === 'undefined') {
        return { activeId: null, tabs: [] };
    }

    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(tabsStorageKey) ?? '[]') as unknown;
        const tabs = Array.isArray(parsed) ? parsed.filter(isBrowserTab) : [];
        const activeId = window.sessionStorage.getItem(activeStorageKey) || null;

        return { activeId, tabs };
    } catch {
        return { activeId: null, tabs: [] };
    }
}

function write(state: BrowserTabsState) {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(tabsStorageKey, JSON.stringify(state.tabs));

    if (state.activeId) {
        window.sessionStorage.setItem(activeStorageKey, state.activeId);
    } else {
        window.sessionStorage.removeItem(activeStorageKey);
    }
}

function isBrowserTab(value: unknown): value is BrowserTab {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as BrowserTab).id === 'string' &&
        typeof (value as BrowserTab).route === 'string'
    );
}
