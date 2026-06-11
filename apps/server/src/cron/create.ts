import { isTavernManagedCronName } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../agent-runtime/cron.ts';
import { requirePrimaryAgent } from '../agents/catalog.ts';
import { emitCronUpdated } from '../api/invalidation-events.ts';
import { getRuntimeChatRecord } from '../chat/runtime-chats.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { saveCronJobRecord } from '../storage/cron-jobs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import { addCronJobParamsSchema } from './contracts.ts';
import { buildHermesCronSchedule } from './schedule-config.ts';

async function resolveCronRuntimeId(input: {
    agentId?: string | null;
    delivery?: { chatId: string } | null;
}) {
    const [agent, deliveryChat] = await Promise.all([
        input.agentId ? getAgentRecord(input.agentId) : null,
        input.delivery?.chatId ? getRuntimeChatRecord(input.delivery.chatId) : null,
    ]);

    if (input.agentId && !agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    if (input.delivery?.chatId && !deliveryChat) {
        throw new Error(`No Tavern chat named "${input.delivery.chatId}" exists.`);
    }

    const runtimeId = agent?.runtimeId ?? deliveryChat?.runtimeId ?? null;

    if (!runtimeId) {
        throw new Error('Cron jobs need an agent or delivery chat to resolve their runtime.');
    }

    if (deliveryChat && deliveryChat.runtimeId !== runtimeId) {
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

    if (isTavernManagedCronName(parsed.name)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Automation names starting with "Tavern: " are reserved.',
        });
    }

    const defaultAgent =
        parsed.payload.kind === 'agentTurn' && !parsed.agentId ? await requirePrimaryAgent() : null;
    const agentId = parsed.agentId ?? defaultAgent?.id;
    const jobId = `tavern:cron:${crypto.randomUUID()}`;
    const { agent, runtimeId } = await resolveCronRuntimeId({
        agentId,
        delivery: parsed.delivery,
    });
    const runtimeClient = await requireConfiguredAgentRuntimeClientForRuntimeId(runtimeId);

    const created = await agentRuntimeCron.createCronJob(
        {
            agentId: agent?.id ?? agentId ?? null,
            deleteAfterRun: parsed.deleteAfterRun ?? false,
            delivery: parsed.delivery ?? null,
            description: parsed.description ?? null,
            enabled: parsed.enabled ?? true,
            id: jobId,
            name: parsed.name,
            payload: parsed.payload,
            schedule: buildHermesCronSchedule(parsed.scheduleConfig),
            wakeMode: parsed.wakeMode,
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
