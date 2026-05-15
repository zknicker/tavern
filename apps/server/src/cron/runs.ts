import { listCronRuns as listStoredCronRuns } from '../storage/cron-runs.ts';
import { cronJobRunListSchema, listCronRunsInputSchema } from './contracts.ts';

export async function listCronRuns(input?: unknown) {
    const parsed = listCronRunsInputSchema.parse(input);
    const runs = await listStoredCronRuns(parsed?.jobId ? { jobId: parsed.jobId } : undefined);
    const limit = parsed?.limit ?? runs.length;

    return cronJobRunListSchema.parse({
        runs: runs.slice(0, limit).map((run) => ({
            deliveryError: run.error,
            deliveryStatus: run.deliveryStatus,
            executionErrorCode: null,
            executionErrorMessage: run.error,
            finishedAt: null,
            id: run.sessionKey,
            jobId: run.jobId,
            scheduledFor: run.runAt,
            sessionId: run.sessionId,
            sessionKey: run.sessionKey,
            startedAt: run.runAt,
            status: run.status ?? 'success',
            summary: run.summary,
            trigger: run.trigger,
        })),
    });
}
