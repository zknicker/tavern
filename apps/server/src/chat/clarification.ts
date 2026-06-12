import {
    requireRuntimeCapabilityHealthy,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import {
    type RespondToChatClarificationInput,
    respondToChatClarificationInputSchema,
    respondToChatClarificationResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

export async function respondToTavernChatClarification(
    input: RespondToChatClarificationInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = respondToChatClarificationInputSchema.parse(input);
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
            method: 'gateway.clarify.respond',
            runtimeId: chatRecord.runtimeId,
        },
        async () =>
            await runtimeClient.respondToChatClarification(parsed.sessionKey, {
                answer: parsed.answer,
                disposition: parsed.disposition,
                requestId: parsed.requestId,
            })
    );

    return respondToChatClarificationResultSchema.parse(result);
}
