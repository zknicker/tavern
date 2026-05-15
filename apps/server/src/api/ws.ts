import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { isAllowedAppOrigin } from '../origin.ts';
import { createApiContext } from './context.ts';
import { wsRouter } from './ws-router.ts';

const trpcWebSocketPath = '/trpc';

export function startTrpcWebSocketServer(server: Server) {
    const wss = new WebSocketServer({
        noServer: true,
    });

    const handler = applyWSSHandler({
        createContext: createApiContext,
        router: wsRouter,
        wss,
    });

    const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (!(request.url && isTrpcWebSocketRequest(request.url))) {
            return;
        }

        if (!isAllowedAppOrigin(request.headers.origin)) {
            socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            return;
        }

        wss.handleUpgrade(request, socket, head, (webSocket) => {
            wss.emit('connection', webSocket, request);
        });
    };

    server.on('upgrade', handleUpgrade);

    process.on('SIGTERM', () => {
        handler.broadcastReconnectNotification();
        wss.close();
    });

    return {
        broadcastReconnectNotification() {
            handler.broadcastReconnectNotification();
        },
        close() {
            server.off('upgrade', handleUpgrade);
            wss.close();
        },
    };
}

function isTrpcWebSocketRequest(requestUrl: string) {
    try {
        return new URL(requestUrl, 'http://localhost').pathname === trpcWebSocketPath;
    } catch {
        return false;
    }
}
