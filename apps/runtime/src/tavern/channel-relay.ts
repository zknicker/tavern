import { randomUUID } from 'node:crypto';
import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeCreateMessageSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeRoutes,
    type TavernChannelInboundMessage,
    tavernChannelClientFrameSchema,
} from '@tavern/api';
import { WebSocket } from 'ws';
import {
    listPendingTavernInboundMessages,
    markTavernInboundMessageAccepted,
    persistTavernInboundMessage,
} from './channel-store';
import { createMessage, upsertResponse } from './chat-api';
import { createAgentParticipantId } from './chat-api/ids';

const defaultAccountId = 'default';

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
    flushPendingInboundMessages(socket);

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
        throw new Error('Tavern messages require a synced OpenClaw session key.');
    }
    if (payload.target.type !== 'channel' && payload.target.type !== 'tavern') {
        throw new Error('Tavern OpenClaw messenger currently supports only root chat messages.');
    }
    if (payload.message.parentMessageId || payload.message.threadRootId) {
        throw new Error('Tavern OpenClaw messenger currently supports only root chat messages.');
    }

    const requestId = randomUUID();
    const messageReceipt = createMessage(chatId, {
        author_id: 'usr_tavern',
        id: payload.message.id,
        metadata: {
            ...(payload.message.metadata ?? {}),
            runtime: {
                agentId: payload.agent.agentId,
                sessionKey,
                source: 'openclaw',
            },
        },
        content: payload.message.content,
        nonce: payload.message.nonce,
        role: 'user',
    });
    const persisted = persistTavernInboundMessage({
        accountId: defaultAccountId,
        agentId: payload.agent.agentId,
        chatId,
        conversation: {
            id: chatId,
            kind: 'channel',
            label: chatId,
            parentId: null,
            threadRootId: null,
        },
        cursor: messageReceipt.cursor,
        messageId: messageReceipt.message.id,
        requestId,
        sessionKey,
    });
    upsertResponse(chatId, {
        id: createResponseId(persisted.runId),
        metadata: {
            runtime: {
                agentId: payload.agent.agentId,
                messageId: persisted.messageId,
                runId: persisted.runId,
                sessionKey,
                source: 'openclaw',
                startedAt: persisted.acceptedAt,
            },
        },
        participant_id: createAgentParticipantId(payload.agent.agentId),
        request_message_id: persisted.messageId,
        status: 'running',
    });
    const socket = findOpenSocket();
    if (socket) {
        sendFrame(socket, persisted.frame);
    }

    return agentRuntimeMessageAcceptedSchema.parse({
        acceptedAt: persisted.acceptedAt,
        cursor: persisted.cursor,
        messageId: persisted.messageId,
        nonce: persisted.frame.message.nonce,
        runId: persisted.runId,
        sequence: persisted.sequence,
        sessionKey: persisted.sessionKey,
        status: 'accepted',
    });
}

function handleClientFrame(value: unknown) {
    const frame = tavernChannelClientFrameSchema.parse(value);

    if (frame.kind === 'message-accepted') {
        const accepted = agentRuntimeMessageAcceptedSchema.parse(frame.accepted);
        markTavernInboundMessageAccepted(frame.requestId, accepted.acceptedAt);
        return;
    }

    if (frame.kind === 'runtime-log') {
        console.warn('[tavern-runtime] Tavern channel relay event', frame.event, frame.payload);
    }
}

function flushPendingInboundMessages(socket: WebSocket) {
    for (const frame of listPendingTavernInboundMessages()) {
        sendFrame(socket, frame);
    }
}

function findOpenSocket() {
    return [...sockets].find((candidate) => candidate.readyState === WebSocket.OPEN) ?? null;
}

function sendFrame(socket: WebSocket, frame: TavernChannelInboundMessage) {
    socket.send(JSON.stringify(frame), (error) => {
        if (error) {
            console.warn('[tavern-runtime] failed to send Tavern channel frame', error);
        }
    });
}

function createResponseId(runId: string) {
    return runId.startsWith('rsp_') ? runId : `rsp_${runId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
