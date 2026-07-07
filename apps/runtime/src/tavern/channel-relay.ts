import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeSteerTurn,
    agentRuntimeCreateMessageSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeSteerTurnResultSchema,
    agentRuntimeSteerTurnSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
} from '@tavern/api';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveAgentModelSelection } from '../models/selection-service.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { enqueueAgentTurn, stopAgentTurn } from './agent-turn-runner.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createRunId } from './chat-api/ids.ts';
import {
    createMessage,
    getResponse,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { ensurePrimaryManagedAgent } from './managed-agent.ts';

export async function sendTavernChannelMessage(
    chatId: string,
    input: AgentRuntimeCreateMessage
): Promise<AgentRuntimeMessageAccepted> {
    const payload = agentRuntimeCreateMessageSchema.parse(input);
    if (payload.target.type !== 'channel' && payload.target.type !== 'tavern') {
        throw new Error('Tavern agent adapter currently supports only root chat messages.');
    }
    if (payload.message.parentMessageId || payload.message.threadRootId) {
        throw new Error('Tavern agent adapter currently supports only root chat messages.');
    }

    const acceptedAt = new Date().toISOString();
    const modelInventory = await listAgentModels();
    if (!modelInventory.models.some((model) => model.availability === 'available')) {
        throw new Error('No executable model is configured. Add or repair a model provider.');
    }
    const runId = createRunId(payload.message.id, payload.agent.agentId);
    const responseId = createResponseId(runId);
    const storedAgent = requireStoredAgent(payload.agent.agentId);
    const agentSession = ensureCurrentAgentSession({
        agentParticipantId: payload.agent.agentId,
        chatId,
        now: acceptedAt,
    });
    const agent = withSelectedModel(storedAgent, agentSession.effectiveModel);
    const messageReceipt = createMessage(chatId, {
        author_id: 'usr_tavern',
        id: payload.message.id,
        metadata: {
            ...(payload.message.metadata ?? {}),
            runtime: {
                agentId: payload.agent.agentId,
                engine: 'agent-engine',
                agentSessionId: agentSession.id,
                ...(payload.message.modelRef ? { modelRef: payload.message.modelRef } : {}),
                runId,
                source: 'agent-engine',
            },
        },
        ...(payload.message.attachments?.length
            ? { attachments: payload.message.attachments }
            : {}),
        content: payload.message.content,
        nonce: payload.message.nonce,
        role: 'user',
    });
    upsertResponse(chatId, {
        id: responseId,
        metadata: {
            runtime: {
                agentId: payload.agent.agentId,
                engine: 'agent-engine',
                agentSessionId: agentSession.id,
                messageId: messageReceipt.message.id,
                runId,
                source: 'agent-engine',
                startedAt: acceptedAt,
            },
        },
        participant_id: createAgentParticipantId(payload.agent.agentId),
        request_message_id: messageReceipt.message.id,
        status: 'running',
    });

    enqueueAgentTurn({
        agent,
        agentSession,
        attachments: payload.message.attachments ?? [],
        chatId,
        content: payload.message.content,
        metadata: payload.message.metadata,
        requestMessageId: messageReceipt.message.id,
        responseId,
        runId,
    });

    return agentRuntimeMessageAcceptedSchema.parse({
        acceptedAt,
        cursor: Number(messageReceipt.cursor),
        messageId: messageReceipt.message.id,
        nonce: payload.message.nonce,
        runId,
        sequence: messageReceipt.message.sequence,
        status: 'accepted',
    });
}

export async function stopTavernChannelTurn(input: { runId: string }) {
    const payload = agentRuntimeStopTurnSchema.parse(input);
    const stopped = await stopAgentTurn(payload.runId);

    return agentRuntimeStopTurnResultSchema.parse({
        runId: payload.runId,
        stopped,
    });
}

export async function steerTavernChannelTurn(_chatId: string, input: AgentRuntimeSteerTurn) {
    const payload = agentRuntimeSteerTurnSchema.parse(input);
    const responseId = createResponseId(payload.runId);
    const response = getResponse(responseId);
    if (!response) {
        return agentRuntimeSteerTurnResultSchema.parse({
            runId: payload.runId,
            steered: false,
        });
    }

    const runtime = readRecord(response.metadata.runtime);
    const content = payload.content.trim();
    const now = new Date().toISOString();
    upsertResponseActivity(response.chat_id, response.id, {
        completed_at: now,
        detail: content,
        id: steerNoticeActivityId(payload.runId),
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: readString(runtime.agentId) ?? undefined,
                engine: 'agent-engine',
                messageId: readString(runtime.messageId) ?? undefined,
                notice: {
                    detail: content,
                    id: 'runtime_notice_steered',
                    kind: 'status',
                    sessionId: readString(runtime.agentSessionId),
                    text: `Steered active turn: ${content}`,
                    title: 'Steered active turn',
                },
                runId: payload.runId,
                source: 'agent-engine',
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Steered active turn',
    });

    return agentRuntimeSteerTurnResultSchema.parse({
        runId: payload.runId,
        steered: true,
    });
}

function createResponseId(runId: string) {
    return runId.startsWith('rsp_') ? runId : `rsp_${runId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function withSelectedModel(
    agent: ReturnType<typeof requireStoredAgent>,
    modelName = resolveAgentModelSelection({ agentId: agent.id })
) {
    return {
        ...agent,
        modelName,
    };
}

function requireStoredAgent(agentId: string) {
    const primary = ensurePrimaryManagedAgent();
    if (agentId === primary.id) {
        return primary;
    }

    const agent = getStoredAgent(agentId);
    if (!agent) {
        throw new Error(`Agent "${agentId}" does not exist.`);
    }
    return agent;
}

function steerNoticeActivityId(runId: string) {
    return `act_${runId}_runtime_notice_steered`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
}
