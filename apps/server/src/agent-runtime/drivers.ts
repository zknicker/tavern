import type { AgentRuntimeEvent } from '@tavern/api';
import { agentRuntimeEventSchema, agentRuntimeRoutes } from '@tavern/api';
import { WebSocket } from 'ws';
import type { TavernAgentRuntimeClient } from './client.ts';
import { createAgentRuntimeClient } from './client.ts';

export interface AgentRuntimeDriverConnection {
    authJson?: null | string;
    baseUrl: string;
}

export interface AgentRuntimeEventObserver {
    onClose?: () => void;
    onEvent: (event: AgentRuntimeEvent) => void;
}

export interface AgentRuntimeEventSubscription {
    close(): void;
}

export function createAgentRuntimeClientForConnection(
    input: AgentRuntimeDriverConnection
): TavernAgentRuntimeClient {
    return createAgentRuntimeClient(input.baseUrl);
}

export async function subscribeAgentRuntimeEventsForConnection(
    input: AgentRuntimeDriverConnection,
    observer: AgentRuntimeEventObserver
): Promise<AgentRuntimeEventSubscription> {
    const socket = new WebSocket(toWebSocketUrl(input.baseUrl, agentRuntimeRoutes.events));

    socket.on('message', (data) => {
        const parsedJson = parseJson(String(data));
        const parsed = agentRuntimeEventSchema.safeParse(parsedJson);
        if (parsed.success) {
            observer.onEvent(parsed.data);
        } else if (process.env.TAVERN_CHAT_DEBUG === '1') {
            console.warn('[tavern:chat:server] dropped runtime event', {
                issues: parsed.error.issues.map((issue) => issue.message),
                raw: parsedJson,
            });
        }
    });
    socket.on('close', () => observer.onClose?.());

    await new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve());
        socket.once('error', reject);
    });

    return {
        close() {
            socket.close();
        },
    };
}

function toWebSocketUrl(baseUrl: string, path: string) {
    const url = new URL(path, baseUrl);
    if (url.protocol === 'http:') {
        url.protocol = 'ws:';
    } else if (url.protocol === 'https:') {
        url.protocol = 'wss:';
    }
    return url.toString();
}

function parseJson(value: string) {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}
