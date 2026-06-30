import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import {
    type StartChatAgentSessionInput,
    startChatAgentSessionInputSchema,
    startChatAgentSessionResultSchema,
} from './contracts.ts';
import { getRuntimeChatRecord } from './runtime-chats.ts';

export async function startTavernChatAgentSession(
    input: StartChatAgentSessionInput,
    client?: TavernAgentRuntimeClient | null
) {
    const parsed = startChatAgentSessionInputSchema.parse(input);
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

    const agentParticipantId =
        parsed.agentParticipantId ?? resolveOnlyAgentParticipantId(chatRecord.chat.participants);
    const result = await runtimeClient.startAgentSession(parsed.chatId, { agentParticipantId });

    return startChatAgentSessionResultSchema.parse({
        chatId: parsed.chatId,
        session: result.session,
    });
}

function resolveOnlyAgentParticipantId(participants: Array<{ agentId?: string; type: string }>) {
    const agentParticipants = participants.filter(
        (participant): participant is { agentId: string; type: 'agent' } =>
            participant.type === 'agent' && typeof participant.agentId === 'string'
    );

    if (agentParticipants.length === 0) {
        throw new Error('This chat does not have an agent seat.');
    }
    if (agentParticipants.length > 1) {
        throw new Error('This chat has multiple agent seats; choose one.');
    }

    return agentParticipants[0].agentId;
}
