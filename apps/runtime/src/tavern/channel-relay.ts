import { randomUUID } from 'node:crypto';
import {
    type AgentRuntimeCreateMessage,
    type AgentRuntimeMessageAccepted,
    agentRuntimeCreateMessageSchema,
    agentRuntimeEventSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeRoutes,
    tavernChannelClientFrameSchema,
    tavernChannelInboundMessageSchema,
} from '@tavern/agent-runtime-protocol';
import { WebSocket } from 'ws';
import { emitTavernRuntimeEvent } from './events';

const defaultAccountId = 'default';
const relayTimeoutMs = 30_000;

const sockets = new Set<WebSocket>();
const pending = new Map<
    string,
    {
        reject: (error: Error) => void;
        resolve: (accepted: AgentRuntimeMessageAccepted) => void;
        timer: ReturnType<typeof setTimeout>;
    }
>();
let cursor = 0;

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
    const socket = [...sockets].find((candidate) => candidate.readyState === WebSocket.OPEN);

    if (!socket) {
        throw new Error('Tavern OpenClaw plugin is not connected to the runtime relay.');
    }

    const requestId = randomUUID();
    const sentAt = new Date().toISOString();
    const frame = tavernChannelInboundMessageSchema.parse({
        accountId: defaultAccountId,
        agentId: payload.agent.agentId,
        conversation: {
            id: chatId,
            kind: 'channel',
            label: chatId,
        },
        cursor: ++cursor,
        kind: 'inbound-message',
        message: {
            attachments: [],
            id: payload.message.id,
            metadata: payload.message.metadata,
            senderId: 'tavern:user',
            senderName: 'Tavern',
            text: payload.message.content,
            timestamp: sentAt,
        },
        requestId,
        sessionKey: payload.target.sessionKey,
    });

    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('Timed out waiting for Tavern OpenClaw plugin acceptance.'));
        }, relayTimeoutMs);

        pending.set(requestId, { reject, resolve, timer });
        socket.send(JSON.stringify(frame), (error) => {
            if (!error) {
                return;
            }

            clearTimeout(timer);
            pending.delete(requestId);
            reject(error);
        });
    });
}

function handleClientFrame(value: unknown) {
    const frame = tavernChannelClientFrameSchema.parse(value);

    if (frame.kind === 'message-accepted') {
        const request = pending.get(frame.requestId);
        if (!request) {
            return;
        }

        clearTimeout(request.timer);
        pending.delete(frame.requestId);
        request.resolve(agentRuntimeMessageAcceptedSchema.parse(frame.accepted));
        return;
    }

    if (frame.kind === 'runtime-event') {
        emitTavernRuntimeEvent(agentRuntimeEventSchema.parse(frame.event));
        return;
    }

    if (frame.kind === 'runtime-log') {
        console.warn('[tavern-runtime] Tavern channel relay event', frame.event, frame.payload);
    }
}

function rejectAllPending(error: Error) {
    for (const [requestId, request] of pending.entries()) {
        clearTimeout(request.timer);
        pending.delete(requestId);
        request.reject(error);
    }
}
