import type { AgentRuntimeCron, AgentRuntimeCronRun } from '@tavern/api';
import type { CronRunInsert } from '../db/schema.ts';
import { buildCronJobId } from '../storage/cron-jobs.ts';

export function toCronRunInsert(input: {
    job?: AgentRuntimeCron | null;
    run: AgentRuntimeCronRun;
    runtimeId: string;
    syncedAt: string;
}): CronRunInsert {
    const sessionKey = input.run.sessionKey ?? input.run.id;

    return {
        agentId: input.job?.agentId ?? null,
        deliveryStatus: input.run.deliveryStatus,
        durationMs: resolveDurationMs(input.run),
        error: input.run.executionErrorMessage,
        jobId: buildCronJobId({
            runtimeCronJobId: input.run.jobId,
        }),
        providerJobId: input.run.jobId,
        runAt: input.run.scheduledFor,
        runtimeId: input.runtimeId,
        runtimeRunId: input.run.id,
        runtimeSessionKey: input.run.sessionKey,
        sessionId: input.run.sessionId ?? input.run.id,
        sessionKey,
        status: input.run.status,
        summary: input.run.summary,
        syncedAt: input.syncedAt,
        trigger: input.run.trigger,
    };
}

function resolveDurationMs(run: AgentRuntimeCronRun) {
    if (!(run.startedAt && run.finishedAt)) {
        return null;
    }

    const startedAt = Date.parse(run.startedAt);
    const finishedAt = Date.parse(run.finishedAt);

    if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) {
        return null;
    }

    return Math.max(0, finishedAt - startedAt);
}
