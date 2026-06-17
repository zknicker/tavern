import type { AgentRuntimeCron } from '@tavern/api';
import { getCronJobRecord, listCronJobRecords, parseCronJobRawJson } from '../storage/cron-jobs.ts';
import { getLatestCronRun, listCronRuns as listStoredCronRuns } from '../storage/cron-runs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import {
    type CronJob,
    type CronList,
    type CronRun,
    cronGetSchema,
    cronListSchema,
    getCronJobInputSchema,
} from './contracts.ts';
import { createDefaultCronSyncState, mapCronJob, mapCronJobSummary } from './mappers.ts';

export async function listCronJobs(): Promise<CronList> {
    await refreshCronState();
    const [jobs, runs] = await Promise.all([listCronJobRecords(), listStoredCronRuns()]);
    const latestRuns = new Map<string, CronRun>();

    for (const run of runs) {
        if (!latestRuns.has(run.jobId)) {
            latestRuns.set(run.jobId, run);
        }
    }

    return cronListSchema.parse({
        jobs: jobs.map((job) =>
            mapCronJobSummary({
                ...withLatestRunState(parseCronJobRawJson(job), latestRuns.get(job.id)),
                agentId: job.agentId,
                id: job.id,
            })
        ),
        sync: createDefaultCronSyncState(),
    });
}

export async function getCronJob(input: unknown): Promise<{
    job: CronJob | null;
}> {
    const parsed = getCronJobInputSchema.parse(input);
    await refreshCronState();
    const [job, latestRun] = await Promise.all([
        getCronJobRecord(parsed.jobId),
        getLatestCronRun(parsed.jobId),
    ]);
    const rawJob = job ? parseCronJobRawJson(job) : null;

    return cronGetSchema.parse({
        job:
            job && rawJob
                ? mapCronJob({
                      ...withLatestRunState(rawJob, latestRun ?? undefined),
                      agentId: job.agentId,
                      id: job.id,
                  })
                : null,
    });
}

async function refreshCronState() {
    try {
        await syncAgentRuntimeCron({ emitUpdates: false });
    } catch (error) {
        console.warn('[tavern] failed to refresh cron state', error);
    }
}

function withLatestRunState(job: AgentRuntimeCron, latestRun?: CronRun): AgentRuntimeCron {
    if (!latestRun) {
        return job;
    }

    const runAtMs = Date.parse(latestRun.runAt);

    if (Number.isNaN(runAtMs)) {
        return job;
    }

    const currentLastRunAtMs = job.state.lastRunAtMs ?? 0;

    if (currentLastRunAtMs > runAtMs) {
        return job;
    }

    return {
        ...job,
        state: {
            ...job.state,
            lastDeliveryStatus: latestRun.deliveryStatus ?? job.state.lastDeliveryStatus,
            lastErrorCode:
                latestRun.status === 'error' && latestRun.error ? 'execution_failed' : undefined,
            lastErrorMessage:
                latestRun.status === 'error' ? (latestRun.error ?? undefined) : undefined,
            lastRunAtMs: runAtMs,
            lastRunStatus: latestRun.status ?? job.state.lastRunStatus,
            lastStatus: latestRun.status ?? job.state.lastStatus,
        },
    };
}
