/**
 * Coalesces managed-engine restart requests from settings saves.
 *
 * A burst of saves (e.g. editing several permission rules) produces one
 * restart, debounced after the last request. The restart is deferred while a
 * chat turn is active so settings changes do not kill in-flight work, with a
 * bounded deferral: past the cap it restarts anyway and relies on the
 * engine's graceful drain.
 */
export interface RestartCoordinator {
    dispose(): void;
    request(): void;
}

export function createRestartCoordinator(input: {
    debounceMs?: number;
    hasActiveTurns: () => boolean;
    maxDeferralMs?: number;
    restart: () => void;
    retryMs?: number;
}): RestartCoordinator {
    const debounceMs = input.debounceMs ?? 3000;
    const maxDeferralMs = input.maxDeferralMs ?? 60_000;
    const retryMs = input.retryMs ?? 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let requestedAt: number | null = null;
    let disposed = false;

    const attempt = () => {
        timer = null;
        if (disposed) {
            return;
        }
        const deferredFor = Date.now() - (requestedAt ?? 0);
        if (input.hasActiveTurns() && deferredFor < maxDeferralMs) {
            timer = setTimeout(attempt, retryMs);
            return;
        }
        requestedAt = null;
        input.restart();
    };

    return {
        dispose() {
            disposed = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        },
        request() {
            if (disposed) {
                return;
            }
            requestedAt ??= Date.now();
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(attempt, debounceMs);
        },
    };
}
