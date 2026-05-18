import { type AgentRuntimeEvent, agentRuntimeEventSchema } from '@tavern/api';
import { asRecord, readString, toIsoString } from '../gateway/records.ts';
import { resolveOpenClawConversationIdentity } from '../mappers/chats/conversation-identity.ts';
import { parseOpenClawSessionKey } from '../mappers/sessions/session-key.ts';
import {
    type AgentRuntimeTurnProgressStep,
    createCommandOutputStep,
    createItemStep,
    createPlanStep,
    createThinkingStep,
    createToolStep,
} from './progress-steps.ts';

export function mapOpenClawAgentProgressEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const stream = readString(payload, ['stream']);

    switch (stream) {
        case 'command_output':
            return mapProgressStep(payload, timestamp, createCommandOutputStep);
        case 'item':
            return mapProgressStep(payload, timestamp, createItemStep);
        case 'plan':
            return mapProgressStep(payload, timestamp, createPlanStep);
        case 'thinking':
            return mapProgressStep(payload, timestamp, createThinkingStep);
        case 'tool':
            return mapProgressStep(payload, timestamp, createToolStep);
        default:
            return [];
    }
}

export function mapOpenClawSessionToolProgressEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    return mapProgressStep(payload, timestamp, createToolStep);
}

function mapProgressStep(
    payload: Record<string, unknown>,
    timestamp: string,
    createStep: (
        data: Record<string, unknown>,
        payload: Record<string, unknown>
    ) => AgentRuntimeTurnProgressStep | null
): AgentRuntimeEvent[] {
    const turn = mapOpenClawProgressTurn(payload, timestamp);

    if (!turn) {
        return [];
    }

    const step = createStep(asRecord(payload.data), payload);

    if (!step) {
        return [];
    }

    return [
        agentRuntimeEventSchema.parse({
            step,
            timestamp,
            turn,
            type: 'turn.progress',
        }),
    ];
}

function mapOpenClawProgressTurn(payload: Record<string, unknown>, timestamp: string) {
    const sessionKey = readString(payload, ['sessionKey', 'key']);
    const runId = readString(payload, ['runId', 'taskId', 'id']);

    if (!(sessionKey && runId)) {
        return null;
    }

    const keyParts = parseOpenClawSessionKey(sessionKey);
    const agentId = readString(payload, ['agentId', 'agent']) ?? keyParts.agentId;
    const chatId = resolveProgressChatId(payload, sessionKey);

    if (!(agentId && chatId)) {
        return null;
    }

    const session = asRecord(payload.session);
    const data = asRecord(payload.data);

    return {
        agentId,
        chatId,
        runId,
        sessionKey,
        startedAt:
            toIsoString(payload.startedAt ?? session.startedAt ?? data.startedAt ?? payload.ts) ??
            timestamp,
    };
}

function resolveProgressChatId(payload: Record<string, unknown>, sessionKey: string) {
    const fromPayload = readString(payload, ['chatId', 'tavernChatId']);
    const metadata = asRecord(payload.metadata);
    const tavern = asRecord(metadata.tavern);
    const fromMetadata = readString(tavern, ['chatId']);

    if (fromPayload) {
        return fromPayload;
    }

    if (fromMetadata) {
        return fromMetadata;
    }

    const identity = resolveOpenClawConversationIdentity({
        record: payload,
        sessionKey,
    });

    if (identity?.platform === 'tavern') {
        return identity.id;
    }

    return parseOpenClawSessionKey(sessionKey).target?.replace(/^chat:/u, '') ?? null;
}
