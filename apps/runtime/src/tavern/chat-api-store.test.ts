import { runtimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    createChat,
    createDelivery,
    createMessage,
    getChat,
    getResponse,
    getResponseActivity,
    listChats,
    listEvents,
    listMessages,
    listResponses,
    markRead,
    searchMessages,
    subscribeToTavernApiEvents,
    upsertArtifact,
    upsertResponse,
    upsertResponseActivity,
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
            upsertResponse('cht_1', {
                id: 'response-1',
                participant_id: 'agt_1',
                status: 'running',
            })
        ).toThrow('Response id must use a rsp_ id.');
    });

    it('stores pinned chat state as a durable chat field', () => {
        createChat({ id: 'cht_1', pinned: true, title: 'Pinned' });
        createChat({ id: 'cht_1', title: 'Renamed' });

        expect(getChat('cht_1')?.pinned).toBe(true);
        expect(listChats().chats[0]?.pinned).toBe(true);

        getDb()
            .prepare("UPDATE chats SET updated_at = '2026-05-28T22:55:00.000Z' WHERE id = 'cht_1'")
            .run();
        createChat({ id: 'cht_1', pinned: false });

        expect(getChat('cht_1')).toMatchObject({
            pinned: false,
            updated_at: '2026-05-28T22:55:00.000Z',
        });
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

    it('searches canonical chat messages by content within one chat', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'podcast note'));
        createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'finance note'));
        createMessage('cht_1', messageInput('msg_3', 'nonce_3', 'Podcast follow-up'));
        createMessage('cht_2', messageInput('msg_4', 'nonce_4', 'podcast in another chat'));

        expect(searchMessages('cht_1', { limit: 10, query: 'podcast' }).messages).toMatchObject([
            { id: 'msg_3', sequence: 3 },
            { id: 'msg_1', sequence: 1 },
        ]);
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

    it('stores responses, activity, artifacts, and read state as cursor-backed events', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const { response } = upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            request_message_id: 'msg_1',
            status: 'running',
            summary: 'Working',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        const { artifact } = upsertArtifact('cht_1', {
            activity_id: 'act_1',
            id: 'art_1',
            kind: 'text',
            response_id: 'rsp_1',
            title: 'Tool output',
        });
        const read = markRead('cht_1', {
            last_read_sequence: 1,
            reader_id: 'usr_1',
        });

        expect(response.summary).toBe('Working');
        expect(activity.title).toBe('Using tool');
        expect(artifact.title).toBe('Tool output');
        expect(read.last_read_sequence).toBe(1);
        expect(listResponses('cht_1').responses).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
        expect(listEvents({ recipientId: 'usr_1' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
            'chat.read',
        ]);
        expect(listEvents({ recipientId: 'usr_2' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
    });

    it('stores terminal response activity in place', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Using tool',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:10.000Z',
            status: 'completed',
            title: 'Using tool',
        });

        expect(activity).toMatchObject({
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'completed',
        });
    });

    it('rejects activity ids that already belong to another response', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_2', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            status: 'running',
            title: 'Assistant reply',
        });

        expect(() =>
            upsertResponseActivity('cht_2', 'rsp_2', {
                id: 'act_1',
                kind: 'message',
                status: 'running',
                title: 'Assistant reply',
            })
        ).toThrow('Activity act_1 belongs to response rsp_1 in chat cht_1.');
    });

    it('closes open activity when the response becomes terminal', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Assistant reply',
        });

        upsertResponse('cht_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });

        expect(listResponses('cht_1').activity).toMatchObject([
            {
                completed_at: expect.any(String),
                id: 'act_1',
                status: 'completed',
            },
        ]);
    });

    it('keeps response pagination stable when activity updates touch older responses', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });

        const firstPage = listResponses('cht_1', { limit: 1 });

        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        getDb()
            .prepare(
                "UPDATE chat_responses SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'rsp_1'"
            )
            .run();

        expect(firstPage.responses.map((response) => response.id)).toEqual(['rsp_1']);
        expect(
            listResponses('cht_1', {
                afterSequence: firstPage.next_sequence ?? 0,
                limit: 1,
            }).responses.map((response) => response.id)
        ).toEqual(['rsp_2']);
    });

    it('does not terminalize the parent response when activity completes or fails', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'queued',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'completed',
            title: 'Used tool',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_2',
            kind: 'tool_call',
            status: 'failed',
            title: 'Used other tool',
        });

        expect(getResponse('rsp_1')).toMatchObject({
            completed_at: null,
            id: 'rsp_1',
            status: 'running',
        });
    });

    it('gets response activity by stable id', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        expect(getResponseActivity('act_1')).toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
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

    it('gets durable response activity through the chat API route', async () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/activity/act_1')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
    });

    it('searches durable messages through the chat API route', async () => {
        await handleTavernRuntimeRequest(jsonRequest('POST', '/api/chats', { id: 'cht_1' }));
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'save this podcast takeaway')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_2', 'nonce_2', 'unrelated note')
            )
        );

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/messages/search?query=podcast&limit=5')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            messages: [{ id: 'msg_1', content: 'save this podcast takeaway', sequence: 1 }],
            next_sequence: null,
        });
    });

    it('filters private event lists by recipient', async () => {
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

    it('returns runtime projection events from the durable chat event log', async () => {
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
        content,
        id,
        ...(nonce ? { nonce } : {}),
        role: 'user' as const,
    };
}

function jsonRequest(method: string, path: string, body: unknown) {
    return new Request(`http://127.0.0.1:18790${path}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}

function getRequest(path: string) {
    return new Request(`http://127.0.0.1:18790${path}`);
}
