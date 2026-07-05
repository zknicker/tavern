import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated } from '../api/invalidation-events.ts';
import { getCronJobRecord, parseCronJobRawJson } from '../storage/cron-jobs.ts';
import { upsertCronRuns } from '../storage/cron-runs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import { runCronJobInputSchema } from './contracts.ts';
import { toCronRunInsert } from './runtime-run-record.ts';

export async function runCronJob(input: unknown) {
    const parsed = runCronJobInputSchema.parse(input);
    const job = await getCronJobRecord(parsed.jobId);

    if (!job) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cron job not found.',
        });
    }

    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(job.runtimeId);

    const run = await agentRuntimeCron.runCronJob(
        job.runtimeCronJobId,
        {
            mode: parsed.mode,
        },
        runtimeClient
    );
    const syncedAt = new Date().toISOString();
    await upsertCronRuns([
        toCronRunInsert({
            job: parseCronJobRawJson(job),
            run,
            runtimeId: job.runtimeId,
            syncedAt,
        }),
    ]);
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron records after run', error);
    });

    emitCronUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
