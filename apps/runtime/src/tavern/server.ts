import http from 'node:http';
import type { Duplex } from 'node:stream';

import { runtimeEventSchema, runtimeRoutes } from '@tavern/api';
import { subscribeOpenClawAgentRuntimeEvents } from '@tavern/openclaw-gateway-adapter';
import { WebSocket, WebSocketServer } from 'ws';

import { getRuntimeHost, getRuntimePort } from '../config';
import {
    recordManagedOpenClawSessionUpdate,
    syncManagedOpenClawAgents,
    syncManagedOpenClawSkills,
} from '../openclaw/agent-sync';
import { createLocalOpenClawGatewayOptions } from '../openclaw/local-client';
import { getManagedOpenClawState } from '../openclaw/state';
import { attachTavernChannelSocket, isTavernChannelSocketPath } from './channel-relay';
import { subscribeToTavernApiEvents } from './chat-api';
import { internalError, toFetchRequest, writeFetchResponse } from './http';
import { handleTavernRuntimeRequest } from './router';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';
import { subscribeToRuntimeEvents } from './runtime-events';

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

export function startTavernRuntimeServer(): TavernRuntimeServerHandle {
    const port = Number(getRuntimePort());
    const host = getRuntimeHost();
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
        if (
            !(
                isEventsSocketPath(request.url) ||
                isTavernApiEventsSocketPath(request.url) ||
                isTavernChannelSocketPath(request.url)
            )
        ) {
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

        closeHandlers.push(openClawEventRelay.addSocket(socket));
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
            openClawEventRelay.close();
            server.close();
        },
        url: new URL(`http://${normalizeHostForUrl(boundHost)}:${boundPort}`),
    };
}

function normalizeHostForUrl(host: string) {
    if (host === '::' || host === '0.0.0.0') {
        return '127.0.0.1';
    }

    return host.includes(':') ? `[${host}]` : host;
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

        if (!getManagedOpenClawState().gatewayReady) {
            scheduleReconnect();
            return;
        }

        connecting = true;
        void subscribeOpenClawAgentRuntimeEvents(
            createLocalOpenClawGatewayOptions(),
            (event) => {
                if (event.type === 'agent.updated') {
                    void syncManagedOpenClawAgents({ publishEvents: false })
                        .catch((error) => {
                            console.warn('[tavern-runtime] failed to sync agents for event', error);
                        })
                        .finally(() => {
                            sendRuntimeEventToSockets(event, sockets);
                        });
                    return;
                }

                if (event.type === 'skill.updated' || event.type === 'skill.deleted') {
                    void syncManagedOpenClawSkills({ publishEvents: false })
                        .catch((error) => {
                            console.warn('[tavern-runtime] failed to sync skills for event', error);
                        })
                        .finally(() => {
                            sendRuntimeEventToSockets(event, sockets);
                        });
                    return;
                }

                if (event.type === 'session.updated') {
                    try {
                        recordManagedOpenClawSessionUpdate(event.session);
                    } catch (error) {
                        console.warn(
                            '[tavern-runtime] failed to record session update event',
                            error
                        );
                    }
                    sendRuntimeEventToSockets(event, sockets);
                    return;
                }

                if (
                    event.type === 'session.invalidated' ||
                    event.type === 'turn.completed' ||
                    event.type === 'turn.failed'
                ) {
                    sendRuntimeEventToSockets(event, sockets);
                    return;
                }

                sendRuntimeEventToSockets(event, sockets);
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

function sendRuntimeEventToSockets(event: unknown, sockets: Set<WebSocket>) {
    const payload = JSON.stringify(runtimeEventSchema.parse(event));

    for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
        }
    }
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
