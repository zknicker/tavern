import {
    getCronJobRecord,
    listCronJobRecords,
    parseCronJobRawJson,
} from '../storage/cron-jobs.ts';
import {
    type CronJob,
    type CronList,
    cronGetSchema,
    cronListSchema,
    getCronJobInputSchema,
} from './contracts.ts';
import { createDefaultCronSyncState, mapCronJob, mapCronJobSummary } from './mappers.ts';

export async function listCronJobs(): Promise<CronList> {
    const jobs = await listCronJobRecords();

    return cronListSchema.parse({
        jobs: jobs.map((job) =>
            mapCronJobSummary({
                ...parseCronJobRawJson(job),
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
    const job = await getCronJobRecord(parsed.jobId);
    const rawJob = job ? parseCronJobRawJson(job) : null;

    return cronGetSchema.parse({
        job:
            job && rawJob
                ? mapCronJob({
                      ...rawJob,
                      agentId: job.agentId,
                      id: job.id,
                  })
                : null,
    });
}
