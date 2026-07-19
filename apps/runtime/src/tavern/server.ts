import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import type { Duplex } from 'node:stream';

import { runtimeEventSchema, runtimeRoutes } from '@tavern/api';
import { type WebSocket, WebSocketServer } from 'ws';
import { getRuntimeApiToken, getRuntimeHost, getRuntimePort } from '../config.ts';
import {
    isRouteAllowedForAuth,
    type RuntimeRequestAuth,
    resolveClerkRequestAuth,
} from '../identity/auth.ts';
import { subscribeToTavernApiEvents } from './chat-api/index.ts';
import {
    forbidden,
    internalError,
    toFetchRequest,
    unauthorized,
    writeFetchResponse,
} from './http.ts';
import { handleTavernRuntimeRequest } from './router.ts';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection.ts';
import { subscribeToRuntimeEvents } from './runtime-events.ts';

export interface TavernRuntimeServerHandle {
    stop(): void;
    url: URL;
}

interface TavernRuntimeServerOptions {
    resolveClerkAuth?: typeof resolveClerkRequestAuth;
}

function isEventsSocketPath(requestUrl: string | undefined) {
    if (!requestUrl) {
        return false;
    }

    try {
        return new URL(requestUrl, 'http://localhost').pathname === runtimeRoutes.events;
    } catch {
        return false;
    }
}

function isTavernApiEventsSocketPath(requestUrl: string | undefined) {
    if (!requestUrl) {
        return false;
    }

    try {
        return new URL(requestUrl, 'http://localhost').pathname === '/api/events/ws';
    } catch {
        return false;
    }
}

function hashToken(token: string): Buffer {
    return createHash('sha256').update(token).digest();
}

function isBearerTokenValid(
    authorizationHeader: string | undefined,
    expectedToken: string
): boolean {
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return false;
    }
    const provided = authorizationHeader.slice(7);
    try {
        const providedHash = hashToken(provided);
        const expectedHash = hashToken(expectedToken);
        return timingSafeEqual(providedHash, expectedHash);
    } catch {
        return false;
    }
}

function authFailureMessage(authorizationHeader: string | undefined): string {
    return authorizationHeader?.startsWith('Bearer ')
        ? 'Bearer token invalid.'
        : 'Bearer token required.';
}

export async function resolveRuntimeRequestAuth(
    authorizationHeader: string | undefined,
    expectedToken: string,
    resolveClerkAuth: typeof resolveClerkRequestAuth = resolveClerkRequestAuth
): Promise<RuntimeRequestAuth | null> {
    if (isBearerTokenValid(authorizationHeader, expectedToken)) {
        return { kind: 'runtime-token' };
    }

    if (!authorizationHeader?.startsWith('Bearer ')) {
        return null;
    }

    return await resolveClerkAuth(authorizationHeader.slice(7));
}

export function startTavernRuntimeServer(
    options: TavernRuntimeServerOptions = {}
): TavernRuntimeServerHandle {
    const port = Number(getRuntimePort());
    const host = getRuntimeHost();
    const token = getRuntimeApiToken();
    const server = http.createServer(async (request, response) => {
        try {
            const fetchRequest = await toFetchRequest(request, `http://127.0.0.1:${port}`);
            const pathname = new URL(fetchRequest.url).pathname;
            // Health route is unauthenticated so the app can probe reachability before pairing.
            const isHealth = pathname === runtimeRoutes.health && fetchRequest.method === 'GET';
            const authorizationHeader = fetchRequest.headers.get('authorization') ?? undefined;
            const auth = await resolveRuntimeRequestAuth(
                authorizationHeader,
                token,
                options.resolveClerkAuth
            );
            if (!(isHealth || auth)) {
                await writeFetchResponse(
                    unauthorized(authFailureMessage(authorizationHeader)),
                    response
                );
                return;
            }
            if (auth && !isRouteAllowedForAuth(auth, pathname, fetchRequest.method)) {
                await writeFetchResponse(
                    forbidden(
                        auth.kind === 'user' && auth.role === 'member'
                            ? 'Runtime owner access required.'
                            : 'Runtime membership required. Redeem an invite first.'
                    ),
                    response
                );
                return;
            }
            const fetchResponse = await handleTavernRuntimeRequest(fetchRequest, auth ?? undefined);
            await writeFetchResponse(fetchResponse, response);
        } catch (error) {
            const fallback = internalError(
                error instanceof Error ? error.message : 'Tavern Runtime request failed.'
            );
            await writeFetchResponse(fallback, response);
        }
    });

    const wss = new WebSocketServer({
        noServer: true,
    });
    const unsubscribeBySocket = new WeakMap<object, () => void>();

    server.on('upgrade', (request, socket: Duplex, head) => {
        if (!(isEventsSocketPath(request.url) || isTavernApiEventsSocketPath(request.url))) {
            socket.destroy();
            return;
        }

        void (async () => {
            const auth = await resolveRuntimeRequestAuth(
                request.headers.authorization,
                token,
                options.resolveClerkAuth
            );
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            if (!(auth && isRouteAllowedForAuth(auth, pathname, 'GET'))) {
                rejectUpgrade(socket);
                return;
            }

            wss.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
                wss.emit('connection', webSocket, request);
            });
        })().catch(() => rejectUpgrade(socket));
    });

    wss.on('connection', (socket: WebSocket, request) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (isTavernApiEventsSocketPath(request.url)) {
            const recipientId = url.searchParams.get('recipient_id');
            const unsubscribe = subscribeToTavernApiEvents(
                (event) => {
                    socket.send(JSON.stringify(event));
                },
                {
                    recipientId,
                }
            );
            unsubscribeBySocket.set(socket, unsubscribe);
            socket.on('close', () => {
                unsubscribeBySocket.get(socket)?.();
                unsubscribeBySocket.delete(socket);
            });
            return;
        }

        const unsubscribe = subscribeToTavernApiEvents((event) => {
            for (const entry of listProjectedTavernRuntimeEvents({
                afterCursor: Number(event.cursor) - 1,
            })) {
                if (entry.cursor === Number(event.cursor)) {
                    socket.send(JSON.stringify(runtimeEventSchema.parse(entry.event)));
                }
            }
        });
        const closeHandlers = [unsubscribe];
        unsubscribeBySocket.set(socket, () => {
            for (const close of closeHandlers) {
                close();
            }
        });

        closeHandlers.push(
            subscribeToRuntimeEvents((event) => {
                socket.send(JSON.stringify(runtimeEventSchema.parse(event)));
            })
        );

        socket.on('close', () => {
            unsubscribeBySocket.get(socket)?.();
            unsubscribeBySocket.delete(socket);
        });
    });

    server.listen(port, host);
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    const boundHost = typeof address === 'object' && address ? address.address : host;

    return {
        stop() {
            for (const client of wss.clients as Set<WebSocket>) {
                client.close();
            }
            wss.close();
            server.close();
        },
        url: new URL(`http://${normalizeHostForUrl(boundHost)}:${boundPort}`),
    };
}

function rejectUpgrade(socket: Duplex) {
    if (!socket.destroyed) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
}

function normalizeHostForUrl(host: string) {
    if (host === '::' || host === '0.0.0.0') {
        return '127.0.0.1';
    }

    return host.includes(':') ? `[${host}]` : host;
}
