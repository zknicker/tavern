import {
    emitAgentUpdated,
    emitCronUpdated,
    emitSyncDataUpdated,
    emitUsageLiveUpdated,
    emitWorkersUpdated,
} from './invalidation-events.ts';

const syncIntervalMs = 15_000;
const usageIntervalMs = 30_000;

let started = false;

export const apiEventSchedulerIntervals = {
    syncIntervalMs,
    usageIntervalMs,
} as const;

export function startApiEventScheduler() {
    if (started) {
        return;
    }

    started = true;

    setInterval(() => {
        emitSyncDataUpdated();
        emitAgentUpdated();
        emitCronUpdated();
        emitWorkersUpdated();
    }, syncIntervalMs);

    setInterval(() => {
        emitUsageLiveUpdated();
    }, usageIntervalMs);
}
