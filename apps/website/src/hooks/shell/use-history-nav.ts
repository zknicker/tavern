import * as React from 'react';
import { useNavigate } from 'react-router-dom';

// Chromium's Navigation API (always present in Electron and Chrome). Typed
// narrowly because the DOM lib does not ship it yet.
interface ChromiumNavigation extends EventTarget {
    canGoBack: boolean;
    canGoForward: boolean;
}

function getNavigation(): ChromiumNavigation | undefined {
    return (window as { navigation?: ChromiumNavigation }).navigation;
}

function subscribe(onChange: () => void) {
    const navigation = getNavigation();

    if (!navigation) {
        return () => {
            // No Navigation API — nothing to unsubscribe.
        };
    }

    navigation.addEventListener('currententrychange', onChange);
    return () => navigation.removeEventListener('currententrychange', onChange);
}

function readCanGoBack() {
    return getNavigation()?.canGoBack ?? true;
}

function readCanGoForward() {
    return getNavigation()?.canGoForward ?? false;
}

// Browser-style history controls for the shell toolbar.
export function useHistoryNav() {
    const navigate = useNavigate();
    const canGoBack = React.useSyncExternalStore(subscribe, readCanGoBack);
    const canGoForward = React.useSyncExternalStore(subscribe, readCanGoForward);

    return {
        back: () => navigate(-1),
        canGoBack,
        canGoForward,
        forward: () => navigate(1),
    };
}
