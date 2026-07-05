import type { AgentRuntimeCronSchedule } from '@tavern/api';
import { getNextCronRun } from '../../node_modules/bunqueue/dist/infrastructure/scheduler/cronParser.js';

export function nextRunAtFromSchedule(
    schedule: AgentRuntimeCronSchedule,
    nowMs = Date.now()
): number | null {
    if (schedule.kind === 'at') {
        const atMs = Date.parse(schedule.at);
        if (!Number.isFinite(atMs)) {
            throw new Error('Cron one-time schedule must be a valid datetime.');
        }
        return atMs > nowMs ? atMs : null;
    }

    if (schedule.kind === 'every') {
        return nowMs + schedule.everyMs;
    }

    return getNextCronRun(schedule.expr, nowMs, schedule.tz ?? 'UTC');
}

export function scheduledForFromQueueJob(input: {
    delay?: number;
    scheduledFor?: string;
    timestamp?: number;
}): string {
    if (input.scheduledFor) {
        return input.scheduledFor;
    }
    const timestamp = input.timestamp ?? Date.now();
    const delay = input.delay ?? 0;
    return new Date(timestamp + delay).toISOString();
}
