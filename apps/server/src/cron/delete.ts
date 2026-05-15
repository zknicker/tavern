import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated, emitSyncDataUpdated } from '../api/invalidation-events.ts';
import { deleteCronJobProjection, getCronJobProjection } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-projections.ts';

export async function deleteCronJob(jobId: string) {
    const projection = await getCronJobProjection(jobId);

    if (!projection) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cron job not found.',
        });
    }

    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(
        projection.runtimeId
    );

    await agentRuntimeCron.deleteCronJob(projection.runtimeCronJobId, runtimeClient);
    await deleteCronJobProjection(jobId);
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron projections after delete', error);
    });
    emitCronUpdated();
    emitSyncDataUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
