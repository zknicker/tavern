export interface TurnStreamThrottle {
    flush(): void;
    schedule(key: string, write: () => void, intervalMs?: number): void;
}

export const turnReplyFlushIntervalMs = 60;
export const turnActivityFlushIntervalMs = 200;

/**
 * Coalesces high-frequency turn stream writes (reply deltas, reasoning and
 * tool progress) into at most one write per key per interval. The first write
 * for an idle key runs immediately; later writes within the window are
 * replaced by the latest one and run when the window closes. Callers must
 * flush() before any ordering boundary (segment completion, turn completion,
 * turn failure) so coalesced writes land before terminal writes.
 */
export function createTurnStreamThrottle(defaultIntervalMs = 100): TurnStreamThrottle {
    const pendingByKey = new Map<
        string,
        { timer: ReturnType<typeof setTimeout>; write: () => void }
    >();
    const lastRunAtByKey = new Map<string, number>();

    const run = (key: string, write: () => void) => {
        lastRunAtByKey.set(key, Date.now());
        write();
    };

    return {
        flush() {
            const pending = [...pendingByKey.entries()];
            pendingByKey.clear();

            for (const [key, entry] of pending) {
                clearTimeout(entry.timer);
                run(key, entry.write);
            }
        },
        schedule(key, write, intervalMs = defaultIntervalMs) {
            const pending = pendingByKey.get(key);

            if (pending) {
                pending.write = write;
                return;
            }

            const elapsedMs = Date.now() - (lastRunAtByKey.get(key) ?? 0);

            if (elapsedMs >= intervalMs) {
                run(key, write);
                return;
            }

            const timer = setTimeout(() => {
                const entry = pendingByKey.get(key);
                pendingByKey.delete(key);

                if (entry) {
                    run(key, entry.write);
                }
            }, intervalMs - elapsedMs);

            pendingByKey.set(key, { timer, write });
        },
    };
}
