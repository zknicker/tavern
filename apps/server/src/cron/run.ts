import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated, emitSyncDataUpdated } from '../api/invalidation-events.ts';
import { getCronJobProjection } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-projections.ts';
import { runCronJobInputSchema } from './contracts.ts';

export async function runCronJob(input: unknown) {
    const parsed = runCronJobInputSchema.parse(input);
    const job = await getCronJobProjection(parsed.jobId);

    if (!job) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cron job not found.',
        });
    }

    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(job.runtimeId);

    await agentRuntimeCron.runCronJob(
        job.runtimeCronJobId,
        {
            mode: parsed.mode,
        },
        runtimeClient
    );
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron projections after run', error);
    });

    emitCronUpdated();
    emitSyncDataUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
