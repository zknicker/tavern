import type { AgentRuntimeCron, AgentRuntimeCronRun } from '@tavern/api';
import type { CronRunInsert } from '../db/schema.ts';
import { buildCronJobId } from '../storage/cron-jobs.ts';

export function toCronRunInsert(input: {
    job?: AgentRuntimeCron | null;
    run: AgentRuntimeCronRun;
    runtimeId: string;
    syncedAt: string;
}): CronRunInsert {
    return {
        chatId: input.run.chatId,
        executionErrorCode: input.run.executionErrorCode,
        executionErrorMessage: input.run.executionErrorMessage,
        finishedAt: input.run.finishedAt,
        id: input.run.id,
        jobId: buildCronJobId({
            runtimeCronJobId: input.run.jobId,
        }),
        runtimeId: input.runtimeId,
        scheduledFor: input.run.scheduledFor,
        startedAt: input.run.startedAt,
        status: input.run.status,
        syncedAt: input.syncedAt,
        trigger: input.run.trigger,
        turnId: input.run.turnId,
    };
}
