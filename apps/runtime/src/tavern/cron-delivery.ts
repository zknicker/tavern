import * as z from 'zod';
import { defaultAgentEngineAgentId } from '../agent-engine/constants';
import { createDelivery } from './chat-api';
import { createAgentParticipantId } from './chat-api/ids';

const cronDeliverySchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    chatId: z.string().trim().startsWith('cht_'),
    content: z.string().trim().min(1),
    cronJobId: z.string().trim().min(1).optional(),
    cronRunId: z.string().trim().min(1).optional(),
    deliveryId: z.string().trim().min(1).optional(),
    agentMessageId: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    sessionId: z.string().trim().min(1).optional(),
    sessionKey: z.string().trim().min(1).optional(),
});

type CronDeliveryInput = z.infer<typeof cronDeliverySchema>;

export function deliverAgentCronToTavernChat(rawInput: unknown) {
    const input = cronDeliverySchema.parse(rawInput);
    const agentId = input.agentId ?? defaultAgentEngineAgentId;
    const participantId = createAgentParticipantId(agentId);
    const sourceId = stableSourceId(input);
    const runId = `run_${sourceId}`;
    const sessionKey = input.sessionKey ?? input.sessionId ?? input.cronRunId ?? `cron:${sourceId}`;
    const startedAt = new Date().toISOString();
    const runtimeMetadata = {
        agentId,
        cronJobId: input.cronJobId ?? null,
        cronRunId: input.cronRunId ?? null,
        agentMessageId: input.agentMessageId ?? null,
        runId,
        sessionId: input.sessionId ?? null,
        sessionKey,
        source: 'agent-cron',
        startedAt,
    };

    return createDelivery(input.chatId, {
        agent_id: participantId,
        id: `del_${sourceId}`,
        message: {
            author_id: participantId,
            content: input.content,
            id: `msg_${sourceId}`,
            metadata: {
                ...(input.metadata ?? {}),
                runtime: runtimeMetadata,
            },
            role: 'assistant',
        },
        metadata: {
            ...(input.metadata ?? {}),
            runtime: runtimeMetadata,
        },
        turn_id: runId,
    });
}

function stableSourceId(input: CronDeliveryInput) {
    return sanitizeTavernIdSuffix(
        input.deliveryId ??
            input.cronRunId ??
            input.agentMessageId ??
            input.sessionId ??
            `cron_${Date.now()}`
    );
}

function sanitizeTavernIdSuffix(value: string) {
    return value.replace(/^(del_|msg_|run_)/u, '').replace(/[^A-Za-z0-9_-]/g, '_');
}
