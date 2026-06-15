import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeCreateMessageSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeRoutes,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
    tavernChannelClientFrameSchema,
} from '@tavern/api';
import type { WebSocket } from 'ws';
import { createAgentParticipantId, createRunId } from './chat-api/ids.ts';
import { createMessage, upsertResponse } from './chat-api/index.ts';
import { interruptHermesTurn, runHermesTurn } from './hermes-turn-runner.ts';

const sockets = new Set<WebSocket>();

export function isTavernChannelSocketPath(requestUrl: string | undefined) {
    if (!requestUrl) {
        return false;
    }

    try {
        return new URL(requestUrl, 'http://localhost').pathname === agentRuntimeRoutes.chatSocket;
    } catch {
        return false;
    }
}

export function attachTavernChannelSocket(socket: WebSocket) {
    sockets.add(socket);

    socket.on('message', (data) => {
        try {
            handleClientFrame(JSON.parse(data.toString()));
        } catch (error) {
            console.warn('[tavern-runtime] failed to process Tavern channel frame', error);
        }
    });
    socket.on('close', () => sockets.delete(socket));
}

export async function sendTavernChannelMessage(
    chatId: string,
    input: AgentRuntimeCreateMessage
): Promise<AgentRuntimeMessageAccepted> {
    const payload = agentRuntimeCreateMessageSchema.parse(input);
    const sessionKey = payload.target.sessionKey;

    if (!sessionKey) {
        throw new Error('Tavern messages require a synced Hermes session key.');
    }
    if (payload.target.type !== 'channel' && payload.target.type !== 'tavern') {
        throw new Error('Tavern Hermes adapter currently supports only root chat messages.');
    }
    if (payload.message.parentMessageId || payload.message.threadRootId) {
        throw new Error('Tavern Hermes adapter currently supports only root chat messages.');
    }

    const acceptedAt = new Date().toISOString();
    const runId = createRunId(payload.message.id);
    const responseId = createResponseId(runId);
    const messageReceipt = createMessage(chatId, {
        author_id: 'usr_tavern',
        id: payload.message.id,
        metadata: {
            ...(payload.message.metadata ?? {}),
            runtime: {
                agentId: payload.agent.agentId,
                ...(payload.message.modelRef ? { modelRef: payload.message.modelRef } : {}),
                sessionKey,
                source: 'hermes',
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
                messageId: messageReceipt.message.id,
                runId,
                sessionKey,
                source: 'hermes',
                startedAt: acceptedAt,
            },
        },
        participant_id: createAgentParticipantId(payload.agent.agentId),
        request_message_id: messageReceipt.message.id,
        status: 'running',
    });

    void runHermesTurn({
        agentId: payload.agent.agentId,
        attachments: payload.message.attachments ?? [],
        chatId,
        content: payload.message.content,
        metadata: payload.message.metadata,
        modelRef: payload.message.modelRef,
        requestMessageId: messageReceipt.message.id,
        responseId,
        runId,
        sessionKey,
    });

    return agentRuntimeMessageAcceptedSchema.parse({
        acceptedAt,
        cursor: Number(messageReceipt.cursor),
        messageId: messageReceipt.message.id,
        nonce: payload.message.nonce,
        runId,
        sequence: messageReceipt.message.sequence,
        sessionKey,
        status: 'accepted',
    });
}

export async function stopTavernChannelTurn(input: { runId: string }) {
    const payload = agentRuntimeStopTurnSchema.parse(input);
    const stopped = await interruptHermesTurn(payload.runId);

    if (!stopped) {
        throw new Error(`No active Hermes turn found for run "${payload.runId}".`);
    }

    return agentRuntimeStopTurnResultSchema.parse({
        runId: payload.runId,
        stopped,
    });
}

function handleClientFrame(value: unknown) {
    const frame = tavernChannelClientFrameSchema.parse(value);

    if (frame.kind === 'message-accepted') {
        agentRuntimeMessageAcceptedSchema.parse(frame.accepted);
        return;
    }

    if (frame.kind === 'runtime-log') {
        console.warn('[tavern-runtime] Tavern channel relay event', frame.event, frame.payload);
    }
}

function createResponseId(runId: string) {
    return runId.startsWith('rsp_') ? runId : `rsp_${runId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
