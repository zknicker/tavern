import { isTavernManagedCronName } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated } from '../api/invalidation-events.ts';
import { deleteCronJobRecord, getCronJobRecord } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';

export async function deleteCronJob(jobId: string) {
    const job = await getCronJobRecord(jobId);

    if (!job) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cron job not found.',
        });
    }

    if (isTavernManagedCronName(job.name)) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message:
                'This automation is managed by Tavern and cannot be deleted. Pause it instead.',
        });
    }

    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(job.runtimeId);

    await agentRuntimeCron.deleteCronJob(job.runtimeCronJobId, runtimeClient);
    await deleteCronJobRecord(jobId);
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron records after delete', error);
    });
    emitCronUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
