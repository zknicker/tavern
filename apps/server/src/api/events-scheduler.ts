import { emitUsageLiveUpdated } from './invalidation-events.ts';

const usageIntervalMs = 30_000;

let started = false;

export const apiEventSchedulerIntervals = {
    usageIntervalMs,
} as const;

export function startApiEventScheduler() {
    if (started) {
        return;
    }

    started = true;

    setInterval(() => {
        emitUsageLiveUpdated();
    }, usageIntervalMs);
}
