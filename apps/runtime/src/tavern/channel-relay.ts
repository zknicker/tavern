import { randomUUID } from 'node:crypto';
import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeCreateMessageSchema,
    agentRuntimeEventSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeRoutes,
    type TavernChannelInboundMessage,
    tavernChannelClientFrameSchema,
} from '@tavern/agent-runtime-protocol';
import { WebSocket } from 'ws';
import {
    listPendingTavernInboundMessages,
    markTavernInboundMessageAccepted,
    type PersistedInboundMessage,
    persistTavernInboundMessage,
    persistTavernRuntimeEvent,
} from './channel-store';
import { emitTavernRuntimeEvent } from './events';

const defaultAccountId = 'default';
const relayTimeoutMs = 30_000;

const sockets = new Set<WebSocket>();
const pending = new Map<
    string,
    {
        reject: (error: Error) => void;
        resolve: (accepted: AgentRuntimeMessageAccepted) => void;
        persisted: PersistedInboundMessage;
        timer: ReturnType<typeof setTimeout>;
    }
>();

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
    socket.on('close', () => {
        sockets.delete(socket);
        rejectAllPending(new Error('Tavern OpenClaw plugin disconnected.'));
    });
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
    if (payload.target.type !== 'channel') {
        throw new Error('Tavern OpenClaw messenger currently supports only root chat messages.');
    }
    if (payload.message.parentMessageId || payload.message.threadRootId) {
        throw new Error('Tavern OpenClaw messenger currently supports only root chat messages.');
    }

    const socket = findOpenSocket();
    if (!socket) {
        throw new Error('Tavern OpenClaw plugin is not connected to the runtime relay.');
    }

    const requestId = randomUUID();
    const sentAt = new Date().toISOString();
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
        message: {
            content: payload.message.content,
            id: payload.message.id,
            metadata: payload.message.metadata,
            nonce: payload.message.nonce,
            parentMessageId: payload.message.parentMessageId,
            threadRootId: payload.message.threadRootId,
        },
        requestId,
        sentAt,
        sessionKey,
    });
    emitTavernRuntimeEvent(persisted.acceptedEvent);

    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('Timed out waiting for Tavern OpenClaw plugin acceptance.'));
        }, relayTimeoutMs);

        pending.set(requestId, { persisted, reject, resolve, timer });
        sendFrame(socket, persisted.frame);
    });
}

function handleClientFrame(value: unknown) {
    const frame = tavernChannelClientFrameSchema.parse(value);

    if (frame.kind === 'message-accepted') {
        const accepted = agentRuntimeMessageAcceptedSchema.parse(frame.accepted);
        markTavernInboundMessageAccepted(frame.requestId, accepted.acceptedAt);
        const request = pending.get(frame.requestId);
        if (request) {
            clearTimeout(request.timer);
            pending.delete(frame.requestId);
            request.resolve(
                agentRuntimeMessageAcceptedSchema.parse({
                    ...accepted,
                    cursor: accepted.cursor ?? request.persisted.cursor,
                    messageId: accepted.messageId ?? request.persisted.messageId,
                    sequence: accepted.sequence ?? request.persisted.sequence,
                })
            );
        }
        return;
    }

    if (frame.kind === 'runtime-event') {
        const persisted = persistTavernRuntimeEvent({
            deliveryId: frame.deliveryId,
            event: agentRuntimeEventSchema.parse(frame.event),
        });
        emitTavernRuntimeEvent(persisted.event);
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

function rejectAllPending(error: Error) {
    for (const [requestId, request] of pending.entries()) {
        clearTimeout(request.timer);
        pending.delete(requestId);
        request.reject(error);
    }
}
