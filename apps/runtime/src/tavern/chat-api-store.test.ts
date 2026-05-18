import { runtimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    createChat,
    createDelivery,
    createMessage,
    listActivity,
    listEvents,
    listMessages,
    markRead,
    subscribeToTavernApiEvents,
    updateActivity,
} from './chat-api';
import { handleTavernRuntimeRequest } from './router';

describe('Tavern Runtime Chat API store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('creates messages with per-chat sequence, events, and idempotent nonce receipts', () => {
        createChat({ id: 'cht_1', title: 'Test' });
        const first = createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const replay = createMessage('cht_1', messageInput('msg_retry', 'nonce_1', 'hello'));
        const second = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'again'));

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(true);
        expect(replay.message.id).toBe('msg_1');
        expect(first.message.sequence).toBe(1);
        expect(second.message.sequence).toBe(2);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'message.created',
        ]);
    });

    it('rejects nonce reuse for a different durable message shape', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));

        expect(() => createMessage('cht_1', messageInput('msg_2', 'nonce_1', 'different'))).toThrow(
            'already used'
        );
    });

    it('rejects malformed Tavern product ids at the write boundary', () => {
        expect(() => createChat({ id: 'chat-1' })).toThrow('Chat id must use a cht_ id.');

        createChat({ id: 'cht_1' });

        expect(() => createMessage('cht_1', messageInput('message-1', 'nonce_1', 'hello'))).toThrow(
            'Message id must use a msg_ id.'
        );
        expect(() =>
            createDelivery('cht_1', {
                agent_id: 'main',
                id: 'delivery-1',
                message: {
                    ...messageInput('msg_1', undefined, 'done'),
                    author_id: 'agt_1',
                    role: 'assistant',
                },
                turn_id: 'turn-1',
            })
        ).toThrow('Delivery id must use a del_ id.');
        expect(() =>
            updateActivity('cht_1', {
                agent_id: 'main',
                run_id: 'run_1',
                status: 'running',
            })
        ).toThrow('Activity agent id must use a agt_ id.');
    });

    it('writes delivery, assistant message, and delivered event in one receipt', () => {
        createChat({ id: 'cht_1' });
        const receipt = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(receipt.message.role).toBe('assistant');
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.at(-1)?.type).toBe('message.delivered');
    });

    it('links repeated assistant delivery receipts to the existing durable message', () => {
        createChat({ id: 'cht_1' });
        const first = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });
        const replay = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_2',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(false);
        expect(replay.message.id).toBe('msg_agt_1');
        expect(replay.message.sequence).toBe(first.message.sequence);
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.delivered',
            'message.delivered',
        ]);
    });

    it('stores activity and read state as cursor-backed events', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const activity = updateActivity('cht_1', {
            agent_id: 'agt_1',
            run_id: 'run_1',
            status: 'running',
            summary: 'Working',
        });
        const read = markRead('cht_1', {
            last_read_sequence: 1,
            reader_id: 'usr_1',
        });

        expect(activity.summary).toBe('Working');
        expect(read.last_read_sequence).toBe(1);
        expect(listActivity().activities).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'chat.activity.updated',
        ]);
        expect(listEvents({ recipientId: 'usr_1' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'chat.activity.updated',
            'chat.read',
        ]);
        expect(listEvents({ recipientId: 'usr_2' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'chat.activity.updated',
        ]);
    });

    it('publishes private read events only to matching recipients', () => {
        const publicEvents: string[] = [];
        const readerEvents: string[] = [];
        const otherEvents: string[] = [];
        const unsubscribers = [
            subscribeToTavernApiEvents((event) => publicEvents.push(event.type)),
            subscribeToTavernApiEvents((event) => readerEvents.push(event.type), {
                recipientId: 'usr_1',
            }),
            subscribeToTavernApiEvents((event) => otherEvents.push(event.type), {
                recipientId: 'usr_2',
            }),
        ];

        try {
            createChat({ id: 'cht_1' });
            createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
            markRead('cht_1', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            });
        } finally {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        }

        expect(publicEvents).toEqual(['message.created']);
        expect(readerEvents).toEqual(['message.created', 'chat.read']);
        expect(otherEvents).toEqual(['message.created']);
    });
});

describe('Tavern Runtime Chat API routes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('returns OpenAPI-shaped route payloads', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', {
                id: 'cht_1',
                title: 'Test',
            })
        );
        const response = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            idempotent: false,
            message: {
                chat_id: 'cht_1',
                id: 'msg_1',
                sequence: 1,
            },
        });

        const replay = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_retry', 'nonce_1', 'hello')
            )
        );

        expect(replay.status).toBe(200);
        await expect(replay.json()).resolves.toMatchObject({
            idempotent: true,
            message: {
                id: 'msg_1',
                sequence: 1,
            },
        });
    });

    it('filters private event replay by recipient', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/read', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            })
        );

        const otherRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_2')
        );
        await expect(otherRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }],
        });

        const readerRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_1')
        );
        await expect(readerRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }, { type: 'chat.read' }],
        });
    });

    it('returns runtime replay events from the durable chat event log', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/messages', {
                ...messageInput('msg_1', 'nonce_1', 'hello'),
                metadata: {
                    runtime: {
                        agentId: 'agt_1',
                        sessionKey: 'session_1',
                    },
                },
            })
        );

        const response = await handleTavernRuntimeRequest(getRequest(runtimeRoutes.events));

        await expect(response.json()).resolves.toMatchObject({
            events: [
                {
                    agentId: 'agt_1',
                    chatId: 'cht_1',
                    message: {
                        id: 'msg_1',
                        sequence: 1,
                        text: 'hello',
                    },
                    sessionKey: 'session_1',
                    type: 'chat.messageAccepted',
                },
            ],
        });
    });
});

function messageInput(id: string, nonce: string | undefined, content: string) {
    return {
        author_id: 'usr_1',
        id,
        ...(nonce ? { nonce } : {}),
        parts: [
            {
                content,
                kind: 'text' as const,
            },
        ],
        role: 'user' as const,
    };
}

function jsonRequest(method: string, path: string, body: unknown) {
    return new Request(`http://127.0.0.1:4310${path}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}

function getRequest(path: string) {
    return new Request(`http://127.0.0.1:4310${path}`);
}
