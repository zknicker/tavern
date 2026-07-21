import * as React from 'react';

export function useViewportBelow(breakpoint: number) {
    const query = `(max-width: ${String(breakpoint - 1)}px)`;

    return React.useSyncExternalStore(
        (listener) => subscribe(query, listener),
        () => window.matchMedia(query).matches,
        () => false
    );
}

function subscribe(query: string, listener: () => void) {
    const media = window.matchMedia(query);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
}
