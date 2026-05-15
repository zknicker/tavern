const activeTurnSessionTtlMs = 5 * 60 * 1000;
const activeTurnSessionKeys = new Set<string>();
const activeTurnSessionCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function markTurnSessionActive(sessionKey: string) {
    activeTurnSessionKeys.add(sessionKey);

    const existingTimer = activeTurnSessionCleanupTimers.get(sessionKey);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        activeTurnSessionCleanupTimers.delete(sessionKey);
        activeTurnSessionKeys.delete(sessionKey);
    }, activeTurnSessionTtlMs);
    timer.unref?.();
    activeTurnSessionCleanupTimers.set(sessionKey, timer);
}

export function clearTurnSessionActive(sessionKey: string) {
    activeTurnSessionKeys.delete(sessionKey);

    const timer = activeTurnSessionCleanupTimers.get(sessionKey);
    if (timer) {
        clearTimeout(timer);
        activeTurnSessionCleanupTimers.delete(sessionKey);
    }
}

export function hasActiveTurnSession(sessionKey: string) {
    return activeTurnSessionKeys.has(sessionKey);
}
