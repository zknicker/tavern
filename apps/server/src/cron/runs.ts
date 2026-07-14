import { listCronRuns as listStoredCronRuns } from '../storage/cron-runs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import {
    type CronJobRun,
    type CronRun,
    cronJobRunListSchema,
    listCronRunsInputSchema,
} from './contracts.ts';

export async function listCronRuns(input?: unknown) {
    const parsed = listCronRunsInputSchema.parse(input);
    await refreshCronState();
    const runs = await listStoredCronRuns(parsed?.jobId ? { jobId: parsed.jobId } : undefined);
    const mappedRuns = runs.map(mapStoredCronRun).sort(compareCronJobRuns);
    const limit = parsed?.limit ?? mappedRuns.length;

    return cronJobRunListSchema.parse({
        runs: mappedRuns.slice(0, limit),
    });
}

async function refreshCronState() {
    try {
        await syncAgentRuntimeCron({ emitUpdates: false });
    } catch (error) {
        console.warn('[tavern] failed to refresh cron runs', error);
    }
}

function mapStoredCronRun(run: CronRun): CronJobRun {
    return {
        chatId: run.chatId,
        executionErrorCode: run.executionErrorCode,
        executionErrorMessage: run.executionErrorMessage,
        finishedAt: run.finishedAt,
        id: run.id,
        jobId: run.jobId,
        quiet: run.quiet ?? false,
        scheduledFor: run.scheduledFor,
        scriptExitCode: run.scriptExitCode,
        scriptStderr: run.scriptStderr,
        startedAt: run.startedAt,
        status: run.status,
        trigger: run.trigger,
        turnId: run.turnId,
    };
}

function compareCronJobRuns(left: CronJobRun, right: CronJobRun) {
    return (
        getCronJobRunTimeMs(right) - getCronJobRunTimeMs(left) || right.id.localeCompare(left.id)
    );
}

function getCronJobRunTimeMs(run: CronJobRun) {
    return Date.parse(run.finishedAt ?? run.startedAt ?? run.scheduledFor);
}
