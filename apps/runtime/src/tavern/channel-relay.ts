import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeCreateMessageSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
} from '@tavern/api';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveAgentModelSelection } from '../models/selection-service.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { enqueueAgentTurn, stopAgentTurn } from './agent-turn-runner.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createRunId } from './chat-api/ids.ts';
import { createMessage, upsertResponse } from './chat-api/index.ts';
import { ensurePrimaryManagedAgent } from './managed-agent.ts';
import { ensureFreshAgentSession } from './session-freshness.ts';

export async function sendTavernChannelMessage(
    chatId: string,
    input: AgentRuntimeCreateMessage
): Promise<AgentRuntimeMessageAccepted> {
    const payload = agentRuntimeCreateMessageSchema.parse(input);
    if (payload.target.type !== 'channel' && payload.target.type !== 'tavern') {
        throw new Error('Grotto agent adapter currently supports only root chat messages.');
    }
    const acceptedAt = new Date().toISOString();
    const modelInventory = await listAgentModels();
    if (!modelInventory.models.some((model) => model.availability === 'available')) {
        throw new Error('No executable model is configured. Add or repair a model provider.');
    }
    const runId = createRunId(payload.message.id, payload.agent.agentId);
    const responseId = createResponseId(runId);
    const storedAgent = requireStoredAgent(payload.agent.agentId);
    ensureFreshAgentSession({ agentId: payload.agent.agentId });
    const agentSession = ensureCurrentAgentSession({
        agentId: payload.agent.agentId,
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
        agentParticipantId: createAgentParticipantId(payload.agent.agentId),
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
