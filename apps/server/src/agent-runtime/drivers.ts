import type { AgentRuntimeEvent } from '@tavern/api';
import { agentRuntimeEventSchema, agentRuntimeRoutes } from '@tavern/api';
import { createTavernClient } from '@tavern/sdk';
import { WebSocket } from 'ws';
import { parseAgentRuntimeConnectionAuth } from '../agent-runtime-connection/auth.ts';
import { getCurrentSessionToken } from '../identity/session-token-store.ts';
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
    input: AgentRuntimeDriverConnection,
    getSessionToken: () => string | null = getCurrentSessionToken
): TavernAgentRuntimeClient {
    const auth = parseAgentRuntimeConnectionAuth(input.authJson);
    return createAgentRuntimeClient(input.baseUrl, {
        token: resolveConnectionBearer(auth, getSessionToken),
    });
}

export function createTavernClientForConnection(
    input: AgentRuntimeDriverConnection,
    getSessionToken: () => string | null = getCurrentSessionToken
) {
    const auth = parseAgentRuntimeConnectionAuth(input.authJson);
    return createTavernClient({
        baseUrl: input.baseUrl,
        token: resolveConnectionBearer(auth, getSessionToken),
    });
}

export async function subscribeAgentRuntimeEventsForConnection(
    input: AgentRuntimeDriverConnection,
    observer: AgentRuntimeEventObserver,
    getSessionToken: () => string | null = getCurrentSessionToken
): Promise<AgentRuntimeEventSubscription> {
    const auth = parseAgentRuntimeConnectionAuth(input.authJson);
    const bearer = resolveConnectionBearer(auth, getSessionToken);
    const wsHeaders = bearer ? { authorization: `Bearer ${bearer}` } : undefined;
    const socket = new WebSocket(toWebSocketUrl(input.baseUrl, agentRuntimeRoutes.events), {
        headers: wsHeaders,
    });

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

function resolveConnectionBearer(
    auth: ReturnType<typeof parseAgentRuntimeConnectionAuth>,
    getSessionToken: () => string | null
) {
    if (!auth) {
        return undefined;
    }

    if (auth.kind === 'token') {
        return auth.token;
    }

    const sessionToken = getSessionToken();
    if (!sessionToken) {
        throw new Error('No active user session is available for this Tavern Runtime connection.');
    }

    return sessionToken;
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
