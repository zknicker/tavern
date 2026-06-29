import * as React from 'react';
import { getErrorMessage } from '../sidebar-chat-actions.tsx';

/** Wraps a mutating tab action so failures stay visible without a global toast. */
export function useTabActionHandler<Args extends unknown[]>(run: (...args: Args) => Promise<void>) {
    return React.useCallback(
        async (...args: Args) => {
            try {
                await run(...args);
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: keep topbar failures visible.
                window.alert(getErrorMessage(error));
            }
        },
        [run]
    );
}

export interface TabKeyboardHandlers {
    /** Cmd/Ctrl+W — close the active tab. */
    onCloseActive: () => void;
    /** Ctrl+Tab / Ctrl+Shift+Tab — move to the next / previous tab. */
    onCycle: (direction: 1 | -1) => void;
    /** Cmd/Ctrl+T — open a new tab. */
    onNewTab: () => void;
    /** Cmd/Ctrl+Shift+T — reopen the most recently closed tab. */
    onReopenClosed: () => void;
    /** Cmd/Ctrl+1..8 — activate the tab at this index. */
    onSelectIndex: (index: number) => void;
    /** Cmd/Ctrl+9 — activate the last tab. */
    onSelectLast: () => void;
}

/** Chrome-style tab keyboard shortcuts, dispatched against the latest handlers. */
export function useChatTabKeyboardShortcuts(handlers: TabKeyboardHandlers) {
    const handlersRef = React.useRef(handlers);
    handlersRef.current = handlers;

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const tab = handlersRef.current;

            // Ctrl+Tab cycles on every platform (Cmd+Tab is the OS app switcher).
            if (event.ctrlKey && event.key === 'Tab') {
                event.preventDefault();
                tab.onCycle(event.shiftKey ? -1 : 1);
                return;
            }

            if (!(event.metaKey || event.ctrlKey) || event.altKey) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key === 't') {
                event.preventDefault();

                if (event.shiftKey) {
                    tab.onReopenClosed();
                } else {
                    tab.onNewTab();
                }

                return;
            }

            if (key === 'w' && !event.shiftKey) {
                event.preventDefault();
                tab.onCloseActive();
                return;
            }

            if (!event.shiftKey && /^[1-9]$/.test(event.key)) {
                event.preventDefault();

                if (event.key === '9') {
                    tab.onSelectLast();
                } else {
                    tab.onSelectIndex(Number(event.key) - 1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
