import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated, emitSyncDataUpdated } from '../api/invalidation-events.ts';
import { getRuntimeChatRecord } from '../chat/runtime-chats.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { getCronJobRecord, saveCronJobRecord } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import { updateCronJobInputSchema } from './contracts.ts';
import { buildOpenClawCronSchedule } from './schedule-config.ts';

export async function updateCronJob(input: unknown) {
    const parsed = updateCronJobInputSchema.parse(input);
    const job = await getCronJobRecord(parsed.jobId);

    if (!job) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cron job not found.',
        });
    }

    const [agent, deliveryChat] = await Promise.all([
        parsed.patch.agentId ? getAgentRecord(parsed.patch.agentId) : null,
        parsed.patch.delivery?.chatId ? getRuntimeChatRecord(parsed.patch.delivery.chatId) : null,
    ]);

    if (parsed.patch.agentId && !agent) {
        throw new Error(`No agent named "${parsed.patch.agentId}" exists.`);
    }

    if (agent && agent.runtimeId !== job.runtimeId) {
        throw new Error('Cron jobs cannot move between runtime namespaces.');
    }

    if (parsed.patch.delivery?.chatId && !deliveryChat) {
        throw new Error(`No Tavern chat named "${parsed.patch.delivery.chatId}" exists.`);
    }

    if (deliveryChat && deliveryChat.runtimeId !== job.runtimeId) {
        throw new Error('Cron delivery chat must belong to the same runtime as the cron job.');
    }

    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(job.runtimeId);

    const updated = await agentRuntimeCron.updateCronJob(
        job.runtimeCronJobId,
        {
            agentId: agent?.id ?? parsed.patch.agentId,
            deleteAfterRun: parsed.patch.deleteAfterRun,
            delivery: parsed.patch.delivery,
            description: parsed.patch.description,
            enabled: parsed.patch.enabled,
            name: parsed.patch.name,
            payload: parsed.patch.payload,
            schedule: parsed.patch.scheduleConfig
                ? buildOpenClawCronSchedule(parsed.patch.scheduleConfig)
                : undefined,
            state: parsed.patch.state,
            wakeMode: parsed.patch.wakeMode,
        },
        runtimeClient
    );
    await saveCronJobRecord({
        job: updated,
        runtimeId: job.runtimeId,
    });
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron records after update', error);
    });
    emitCronUpdated();
    emitSyncDataUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
