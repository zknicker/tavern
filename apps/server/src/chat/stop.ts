import {
    requireRuntimeCapabilityHealthy,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import {
    type StopChatTurnInput,
    stopChatTurnInputSchema,
    stopChatTurnResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

export async function stopTavernChatTurn(
    input: StopChatTurnInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = stopChatTurnInputSchema.parse(input);
    const chatRecord = await getRuntimeChatRecord(parsed.chatId);

    if (!chatRecord) {
        throw new Error(`No Grotto chat named "${parsed.chatId}" exists.`);
    }

    const runtimeClient =
        client === undefined
            ? await createConfiguredAgentRuntimeClientForRuntimeId(chatRecord.runtimeId)
            : client;

    if (!runtimeClient) {
        throw new Error(`Grotto Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    await requireRuntimeCapabilityHealthy({
        capability: 'gateway',
        client: runtimeClient,
        runtimeId: chatRecord.runtimeId,
    });

    const result = await withCapabilityStatus(
        {
            capability: 'gateway',
            method: 'gateway.session.interrupt',
            runtimeId: chatRecord.runtimeId,
        },
        async () => await runtimeClient.stopChatTurn(parsed.chatId, { runId: parsed.runId })
    );

    return stopChatTurnResultSchema.parse(result);
}
