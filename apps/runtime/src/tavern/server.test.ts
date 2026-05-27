import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import { startTavernRuntimeServer, type TavernRuntimeServerHandle } from './server.ts';

describe('Tavern Runtime websocket events', () => {
    let previousPort: string | undefined;
    let server: TavernRuntimeServerHandle | null = null;

    beforeEach(() => {
        previousPort = process.env.TAVERN_RUNTIME_PORT;
        process.env.TAVERN_RUNTIME_PORT = '0';
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        server?.stop();
        server = null;
        closeDb();
        if (previousPort === undefined) {
            process.env.TAVERN_RUNTIME_PORT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_PORT = previousPort;
        }
    });

    it('streams live app events without backfilling old events', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'first'));
        server = startTavernRuntimeServer();

        const socket = await openSocket(new URL('/api/events/ws', server.url));
        const messages: unknown[] = [];
        socket.on('message', (data) => messages.push(JSON.parse(String(data))));

        await wait(25);
        expect(messages).toEqual([]);

        createMessage('cht_1', messageInput('msg_2', 'second'));

        await expect(nextMessage(socket)).resolves.toMatchObject({
            message: { id: 'msg_2' },
            type: 'message.created',
        });
        socket.close();
    });

    it('streams later live app events on new sockets', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'first'));
        server = startTavernRuntimeServer();

        const socket = await openSocket(new URL('/api/events/ws', server.url));
        const messages: unknown[] = [];
        socket.on('message', (data) => messages.push(JSON.parse(String(data))));

        await wait(25);
        expect(messages).toEqual([]);

        createMessage('cht_1', messageInput('msg_2', 'second'));

        await expect(nextMessage(socket)).resolves.toMatchObject({
            message: { id: 'msg_2' },
            type: 'message.created',
        });
        socket.close();
    });
});

function messageInput(id: string, content: string) {
    return {
        author_id: 'usr_1',
        content,
        id,
        role: 'user' as const,
    };
}

function openSocket(url: URL) {
    const socket = new WebSocket(url);
    return new Promise<WebSocket>((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

function nextMessage(socket: WebSocket) {
    return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for message.')), 1000);
        socket.once('message', (data) => {
            clearTimeout(timeout);
            resolve(JSON.parse(String(data)));
        });
        socket.once('error', reject);
    });
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
