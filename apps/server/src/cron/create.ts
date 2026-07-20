import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { emitCronUpdated } from '../api/invalidation-events.ts';
import { getRuntimeChatRecord } from '../chat/runtime-chats.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { saveCronJobRecord } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import { addCronJobParamsSchema } from './contracts.ts';
import { buildAgentCronSchedule } from './schedule-config.ts';

async function resolveCronRuntimeId(input: { agentId: string; delivery: { chatId: string } }) {
    const [agent, deliveryChat] = await Promise.all([
        getAgentRecord(input.agentId),
        getRuntimeChatRecord(input.delivery.chatId),
    ]);

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    if (!deliveryChat) {
        throw new Error(`No Grotto chat named "${input.delivery.chatId}" exists.`);
    }

    const runtimeId = agent.runtimeId;

    if (deliveryChat.runtimeId !== runtimeId) {
        throw new Error(
            'Cron delivery chat must belong to the same runtime as the selected agent.'
        );
    }

    return {
        agent,
        runtimeId,
    };
}

export async function createCronJob(input: unknown) {
    const parsed = addCronJobParamsSchema.parse(input);
    const jobId = `tavern:cron:${crypto.randomUUID()}`;
    const { agent, runtimeId } = await resolveCronRuntimeId({
        agentId: parsed.agentId,
        delivery: parsed.delivery,
    });
    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(runtimeId);

    const created = await agentRuntimeCron.createCronJob(
        {
            agentId: agent.id,
            deleteAfterRun: parsed.deleteAfterRun ?? false,
            delivery: parsed.delivery,
            description: parsed.description ?? null,
            enabled: parsed.enabled ?? true,
            id: jobId,
            name: parsed.name,
            payload: parsed.payload,
            schedule: buildAgentCronSchedule(parsed.scheduleConfig),
        },
        runtimeClient
    );
    await saveCronJobRecord({
        job: created,
        runtimeId,
    });
    void syncAgentRuntimeCron().catch((error) => {
        console.warn('[tavern] failed to refresh cron records after create', error);
    });
    emitCronUpdated();

    return {
        success: true as const,
        synced: true,
    };
}
