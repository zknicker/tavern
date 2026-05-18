import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeMessageAcceptedSchema,
} from '@tavern/api';
import { asRecord, nowIso, readNumber, readString, requireString } from '../../gateway/records.ts';

export function mapTavernMessageToOpenClawTavernTurn(
    chatId: string,
    input: AgentRuntimeCreateMessage
) {
    const agentId = input.agent.agentId;
    const sessionKey = resolveOpenClawSendSessionKey(input, agentId);
    const metadata = pickTavernMessageMetadata(input.message.metadata);
    const runId = buildTavernMessageRunId(input.message.id);

    return {
        agent: input.agent,
        chatId,
        message: {
            content: input.message.content,
            id: input.message.id,
            ...(metadata ? { metadata } : {}),
            ...(input.message.nonce ? { nonce: input.message.nonce } : {}),
        },
        sender: {
            id: 'tavern-user',
            name: 'Tavern',
        },
        sessionKey,
        turnId: runId,
    };
}

export function mapTavernMessageToOpenClawChatSend(input: AgentRuntimeCreateMessage) {
    const sessionKey = resolveOpenClawSendSessionKey(input, input.agent.agentId);
    const runId = buildTavernMessageRunId(input.message.id);

    return {
        deliver: false,
        idempotencyKey: runId,
        message: input.message.content,
        sessionKey,
    };
}

export function mapOpenClawMessageAccepted(
    input: unknown,
    fallbackSessionKey?: string | null
): AgentRuntimeMessageAccepted {
    const record = asRecord(input);

    return agentRuntimeMessageAcceptedSchema.parse({
        acceptedAt: readString(record, ['acceptedAt', 'timestamp']) ?? nowIso(),
        cursor: readNumber(record, ['cursor']) ?? undefined,
        messageId: readString(record, ['messageId']) ?? undefined,
        nonce: readString(record, ['nonce']) ?? undefined,
        runId: requireString(record, ['runId', 'taskId', 'id'], 'OpenClaw message acceptance'),
        sequence: readNumber(record, ['sequence']) ?? undefined,
        sessionKey: readString(record, ['sessionKey', 'key']) ?? fallbackSessionKey ?? null,
        status: 'accepted',
    });
}

function resolveOpenClawSendSessionKey(input: AgentRuntimeCreateMessage, agentId: string) {
    if (input.target.sessionKey) {
        return input.target.sessionKey;
    }

    throw new Error(
        `OpenClaw send requires a synced session key for ${agentId} in ${input.target.type}:${input.target.target}.`
    );
}

function pickTavernMessageMetadata(
    metadata: AgentRuntimeCreateMessage['message']['metadata']
): { tavern: Record<string, unknown> } | undefined {
    if (!(metadata && typeof metadata === 'object' && 'tavern' in metadata)) {
        return undefined;
    }

    const record = asRecord(metadata);
    const tavernValue = record.tavern;

    if (!(tavernValue && typeof tavernValue === 'object' && !Array.isArray(tavernValue))) {
        return undefined;
    }

    return { tavern: tavernValue as Record<string, unknown> };
}

function buildTavernMessageRunId(messageId: string) {
    return messageId.startsWith('run_') ? messageId : `run_${stripPrefix(messageId, 'msg_')}`;
}

function stripPrefix(value: string, prefix: string) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
