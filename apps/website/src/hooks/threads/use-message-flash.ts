import * as React from 'react';

const flashedMessages = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

export function useMessageFlash(chatId: string) {
    return React.useSyncExternalStore(
        subscribe,
        () => flashedMessages.get(chatId) ?? null,
        () => null
    );
}

export function flashMessage(chatId: string, messageId: string) {
    const existingTimer = timers.get(chatId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    flashedMessages.set(chatId, messageId);
    emitChange();
    timers.set(
        chatId,
        setTimeout(() => {
            timers.delete(chatId);
            flashedMessages.delete(chatId);
            emitChange();
        }, 1500)
    );
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
