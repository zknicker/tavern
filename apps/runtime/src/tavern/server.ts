import http from 'node:http';
import type { Duplex } from 'node:stream';

import type { RuntimeEvent } from '@tavern/agent-runtime-protocol';
import { runtimeEventSchema, runtimeRoutes } from '@tavern/agent-runtime-protocol';
import { subscribeOpenClawAgentRuntimeEvents } from '@tavern/openclaw-gateway-adapter';
import { WebSocket, WebSocketServer } from 'ws';

import { createLocalOpenClawGatewayOptions } from '../openclaw/local-client';
import { attachTavernChannelSocket, isTavernChannelSocketPath } from './channel-relay';
import { subscribeToTavernRuntimeEvents } from './events';
import { internalError, toFetchRequest, writeFetchResponse } from './http';
import { handleTavernRuntimeRequest } from './router';

export interface TavernRuntimeServerHandle {
    stop(): void;
    url: URL;
}

const openClawReconnectDelayMs = 500;
const openClawReconnectMaxDelayMs = 5000;

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

export function startTavernRuntimeServer(): TavernRuntimeServerHandle {
    const port = Number(process.env.TAVERN_RUNTIME_PORT || 4310);
    const server = http.createServer(async (request, response) => {
        try {
            const fetchRequest = await toFetchRequest(request, `http://127.0.0.1:${port}`);
            const fetchResponse = await handleTavernRuntimeRequest(fetchRequest);
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
    const openClawEventRelay = createOpenClawEventRelay();

    server.on('upgrade', (request, socket: Duplex, head) => {
        if (!(isEventsSocketPath(request.url) || isTavernChannelSocketPath(request.url))) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
            wss.emit('connection', webSocket, request);
        });
    });

    wss.on('connection', (socket: WebSocket, request) => {
        if (isTavernChannelSocketPath(request.url)) {
            attachTavernChannelSocket(socket);
            return;
        }

        const unsubscribe = subscribeToTavernRuntimeEvents((event: RuntimeEvent) => {
            socket.send(JSON.stringify(runtimeEventSchema.parse(event)));
        });
        const closeHandlers = [unsubscribe];
        unsubscribeBySocket.set(socket, () => {
            for (const close of closeHandlers) {
                close();
            }
        });

        closeHandlers.push(openClawEventRelay.addSocket(socket));

        socket.on('close', () => {
            unsubscribeBySocket.get(socket)?.();
            unsubscribeBySocket.delete(socket);
        });
    });

    server.listen(port);

    return {
        stop() {
            for (const client of wss.clients as Set<WebSocket>) {
                client.close();
            }
            wss.close();
            openClawEventRelay.close();
            server.close();
        },
        url: new URL(`http://127.0.0.1:${port}`),
    };
}

function createOpenClawEventRelay() {
    const sockets = new Set<WebSocket>();
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let subscription: { close(): void } | null = null;
    let reconnectDelayMs = openClawReconnectDelayMs;
    let failedAttempts = 0;
    let connecting = false;

    const scheduleReconnect = () => {
        if (closed || sockets.size === 0 || reconnectTimer) {
            return;
        }

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, openClawReconnectMaxDelayMs);
    };

    const connect = () => {
        if (closed || sockets.size === 0 || connecting || subscription) {
            return;
        }

        connecting = true;
        void subscribeOpenClawAgentRuntimeEvents(
            createLocalOpenClawGatewayOptions(),
            (event) => {
                const payload = JSON.stringify(runtimeEventSchema.parse(event));

                for (const socket of sockets) {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(payload);
                    }
                }
            },
            {
                onClose: () => {
                    subscription = null;
                    scheduleReconnect();
                },
            }
        )
            .then((nextSubscription) => {
                connecting = false;

                if (closed || sockets.size === 0) {
                    nextSubscription.close();
                    return;
                }

                reconnectDelayMs = openClawReconnectDelayMs;
                failedAttempts = 0;
                subscription = nextSubscription;
            })
            .catch((error) => {
                connecting = false;
                logOpenClawEventReconnectFailure(error, failedAttempts);
                failedAttempts += 1;
                scheduleReconnect();
            });
    };

    const close = () => {
        closed = true;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        subscription?.close();
        subscription = null;
    };

    return {
        addSocket(socket: WebSocket) {
            sockets.add(socket);
            connect();

            return () => {
                sockets.delete(socket);

                if (sockets.size === 0) {
                    subscription?.close();
                    subscription = null;
                    if (reconnectTimer) {
                        clearTimeout(reconnectTimer);
                        reconnectTimer = null;
                    }
                    reconnectDelayMs = openClawReconnectDelayMs;
                    failedAttempts = 0;
                }
            };
        },
        close,
    };
}

function logOpenClawEventReconnectFailure(error: unknown, failedAttempts: number) {
    if (failedAttempts === 0) {
        console.warn('[tavern-runtime] OpenClaw events disconnected; retrying...', error);
        return;
    }

    if (failedAttempts % 12 === 0) {
        console.warn(
            `[tavern-runtime] OpenClaw events still disconnected after ${failedAttempts + 1} attempts.`
        );
    }
}
