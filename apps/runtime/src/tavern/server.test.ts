import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import { startTavernRuntimeServer, type TavernRuntimeServerHandle } from './server.ts';

const TEST_TOKEN = 'test-runtime-api-token';

describe('Tavern Runtime HTTP auth', () => {
    let previousPort: string | undefined;
    let previousToken: string | undefined;
    let server: TavernRuntimeServerHandle | null = null;

    beforeEach(() => {
        previousPort = process.env.TAVERN_RUNTIME_PORT;
        previousToken = process.env.TAVERN_RUNTIME_TOKEN;
        process.env.TAVERN_RUNTIME_PORT = '0';
        process.env.TAVERN_RUNTIME_TOKEN = TEST_TOKEN;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        server?.stop();
        server = null;
        closeDb();
        process.env.TAVERN_RUNTIME_PORT = previousPort === undefined ? undefined : previousPort;
        process.env.TAVERN_RUNTIME_TOKEN = previousToken === undefined ? undefined : previousToken;
    });

    it('returns 401 for requests without a token', async () => {
        server = startTavernRuntimeServer();
        const response = await fetch(new URL('/capabilities', server.url));
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            message: 'Bearer token required.',
        });
    });

    it('returns 401 for requests with a wrong token', async () => {
        server = startTavernRuntimeServer();
        const response = await fetch(new URL('/capabilities', server.url), {
            headers: { authorization: 'Bearer wrong-token' },
        });
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            message: 'Bearer token invalid.',
        });
    });

    it('allows requests with the correct token', async () => {
        server = startTavernRuntimeServer();
        const response = await fetch(new URL('/capabilities', server.url), {
            headers: { authorization: `Bearer ${TEST_TOKEN}` },
        });
        expect(response.status).toBe(200);
    });

    it('allows the health route without a token', async () => {
        server = startTavernRuntimeServer();
        const response = await fetch(new URL('/health', server.url));
        expect(response.status).toBe(200);
    });
});

describe('Tavern Runtime websocket auth', () => {
    let previousPort: string | undefined;
    let previousToken: string | undefined;
    let server: TavernRuntimeServerHandle | null = null;

    beforeEach(() => {
        previousPort = process.env.TAVERN_RUNTIME_PORT;
        previousToken = process.env.TAVERN_RUNTIME_TOKEN;
        process.env.TAVERN_RUNTIME_PORT = '0';
        process.env.TAVERN_RUNTIME_TOKEN = TEST_TOKEN;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        server?.stop();
        server = null;
        closeDb();
        process.env.TAVERN_RUNTIME_PORT = previousPort === undefined ? undefined : previousPort;
        process.env.TAVERN_RUNTIME_TOKEN = previousToken === undefined ? undefined : previousToken;
    });

    it('rejects ws upgrade without a token', async () => {
        server = startTavernRuntimeServer();
        await expect(openSocket(new URL('/api/events/ws', server.url))).rejects.toThrow();
    });

    it('rejects ws upgrade with a wrong token', async () => {
        server = startTavernRuntimeServer();
        await expect(
            openSocket(new URL('/api/events/ws', server.url), 'Bearer wrong-token')
        ).rejects.toThrow();
    });

    it('accepts a Clerk bearer resolved to a runtime member', async () => {
        server = startTavernRuntimeServer({
            resolveClerkAuth: async (token) =>
                token === 'clerk-session-token'
                    ? {
                          kind: 'user',
                          role: 'member',
                          user: {
                              avatarUrl: null,
                              clerkUserId: 'user_member',
                              createdAt: '2026-07-18T12:00:00.000Z',
                              email: null,
                              id: 'usr_member',
                              name: null,
                              updatedAt: '2026-07-18T12:00:00.000Z',
                          },
                      }
                    : null,
        });

        const socket = await openSocket(
            new URL('/api/events/ws', server.url),
            'Bearer clerk-session-token'
        );
        expect(socket.readyState).toBe(WebSocket.OPEN);
        socket.close();
    });
});

describe('Tavern Runtime websocket events', () => {
    let previousPort: string | undefined;
    let previousToken: string | undefined;
    let server: TavernRuntimeServerHandle | null = null;

    beforeEach(() => {
        previousPort = process.env.TAVERN_RUNTIME_PORT;
        previousToken = process.env.TAVERN_RUNTIME_TOKEN;
        process.env.TAVERN_RUNTIME_PORT = '0';
        process.env.TAVERN_RUNTIME_TOKEN = TEST_TOKEN;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        server?.stop();
        server = null;
        closeDb();
        process.env.TAVERN_RUNTIME_PORT = previousPort === undefined ? undefined : previousPort;
        process.env.TAVERN_RUNTIME_TOKEN = previousToken === undefined ? undefined : previousToken;
    });

    it('streams live app events without backfilling old events', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'first'));
        server = startTavernRuntimeServer();

        const socket = await openSocket(
            new URL('/api/events/ws', server.url),
            `Bearer ${TEST_TOKEN}`
        );
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

        const socket = await openSocket(
            new URL('/api/events/ws', server.url),
            `Bearer ${TEST_TOKEN}`
        );
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

function openSocket(url: URL, authorization?: string) {
    const socket = new WebSocket(url, {
        headers: authorization ? { authorization } : undefined,
    });
    return new Promise<WebSocket>((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
        socket.once('unexpected-response', (_req, res) => {
            reject(new Error(`Unexpected response: ${res.statusCode}`));
        });
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
