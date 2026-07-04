import {
    requireRuntimeCapabilityHealthy,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import {
    type SteerChatTurnInput,
    steerChatTurnInputSchema,
    steerChatTurnResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

export async function steerTavernChatTurn(
    input: SteerChatTurnInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = steerChatTurnInputSchema.parse(input);
    const chatRecord = await getRuntimeChatRecord(parsed.chatId);

    if (!chatRecord) {
        throw new Error(`No Tavern chat named "${parsed.chatId}" exists.`);
    }

    const runtimeClient =
        client === undefined
            ? await createConfiguredAgentRuntimeClientForRuntimeId(chatRecord.runtimeId)
            : client;

    if (!runtimeClient) {
        throw new Error(`Tavern Runtime connection "${chatRecord.runtimeId}" is not configured.`);
    }

    await requireRuntimeCapabilityHealthy({
        capability: 'gateway',
        client: runtimeClient,
        runtimeId: chatRecord.runtimeId,
    });

    const result = await withCapabilityStatus(
        {
            capability: 'gateway',
            method: 'gateway.session.steer',
            runtimeId: chatRecord.runtimeId,
        },
        async () =>
            await runtimeClient.steerChatTurn(parsed.chatId, {
                content: parsed.content,
                runId: parsed.runId,
            })
    );

    return steerChatTurnResultSchema.parse(result);
}
