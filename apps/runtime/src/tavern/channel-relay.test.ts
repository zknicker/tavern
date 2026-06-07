import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { attachTavernChannelSocket, sendTavernChannelMessage } from './channel-relay';
import { listPendingTavernInboundMessages } from './channel-store';
import { createChat, createMessage, getChat, listMessages } from './chat-api';

describe('Tavern channel relay', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('creates the OpenAPI chat message before relaying to the plugin', async () => {
        createChat({ id: 'cht_1' });
        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        const accepted = sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        const [frame] = socket.sent;
        expect(frame?.kind).toBe('inbound-message');
        expect(frame?.conversation.label).toBe(null);
        expect(frame?.message.id).toBe('msg_1');
        expect(frame?.message.sequence).toBe(1);
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual(['msg_1']);

        socket.emitMessage({
            accepted: {
                acceptedAt: '2026-05-18T12:00:00.000Z',
                runId: frame?.turnId ?? 'run_1',
                sessionKey: 'session_1',
                status: 'accepted',
            },
            kind: 'message-accepted',
            requestId: frame?.requestId ?? '',
        });

        await expect(accepted).resolves.toMatchObject({
            messageId: 'msg_1',
            sequence: 1,
            status: 'accepted',
        });

        socket.close();
    });

    it('adds label and group prompt for pinned Tavern chats', async () => {
        createChat({
            id: 'cht_1',
            metadata: {
                tavern: {
                    agentIds: ['agt_1'],
                    displayName: '#general',
                    displayNameSource: 'generated',
                    groupSystemPrompt: 'Treat this as the home chat.',
                },
            },
            pinned: true,
            title: '#general',
        });
        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(socket.sent[0]?.conversation).toMatchObject({
            groupChannel: '#general',
            groupSubject: '#general',
            groupSystemPrompt: 'Treat this as the home chat.',
            label: '#general',
        });

        socket.close();
    });

    it('omits label and group prompt for default-titled temporary chats', async () => {
        createChat({
            id: 'cht_1',
            metadata: {
                tavern: {
                    agentIds: ['agt_1'],
                    displayName: 'What should we do next?',
                    displayNameSource: 'generated',
                    groupSystemPrompt: 'Should not be used while unpinned.',
                },
            },
            pinned: false,
            title: 'What should we do next?',
        });
        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(socket.sent[0]?.conversation).toMatchObject({
            id: 'cht_1',
            kind: 'channel',
            label: null,
        });
        expect(socket.sent[0]?.conversation).not.toHaveProperty('groupSubject');
        expect(socket.sent[0]?.conversation).not.toHaveProperty('groupSystemPrompt');

        socket.close();
    });

    it('attaches recent canonical chat history to inbound relay frames', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'first thing'));
        createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'second thing'));
        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'what did I say?',
                id: 'msg_3',
                nonce: 'nonce_3',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(socket.sent[0]?.recentMessages).toEqual([
            expect.objectContaining({
                body: 'first thing',
                messageId: 'msg_1',
            }),
            expect.objectContaining({
                body: 'second thing',
                messageId: 'msg_2',
            }),
        ]);

        socket.close();
    });

    it('returns the durable accepted receipt when the plugin socket is offline', async () => {
        createChat({ id: 'cht_1' });
        const accepted = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello while offline',
                id: 'msg_offline',
                nonce: 'nonce_offline',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(accepted).toMatchObject({
            messageId: 'msg_offline',
            sequence: 1,
            status: 'accepted',
        });
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual([
            'msg_offline',
        ]);
        expect(listPendingTavernInboundMessages()).toHaveLength(1);

        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        expect(socket.sent).toHaveLength(1);
        expect(socket.sent[0]?.message.id).toBe('msg_offline');

        socket.close();
    });

    it('requires Tavern Runtime to own the chat before relaying', async () => {
        await expect(
            sendTavernChannelMessage('cht_missing', {
                agent: {
                    agentId: 'agt_1',
                },
                message: {
                    content: 'hello',
                    id: 'msg_1',
                    nonce: 'nonce_1',
                },
                target: {
                    externalId: null,
                    sessionKey: 'session_1',
                    target: 'cht_missing',
                    type: 'tavern',
                },
            })
        ).rejects.toThrow('Chat cht_missing does not exist.');
    });

    it('preserves Tavern-owned chat metadata when relaying a message', async () => {
        createChat({
            id: 'cht_1',
            metadata: {
                runtime: {
                    source: 'tavern',
                },
                sessionKeys: ['agent:main:tavern:channel:cht_1'],
                tavern: {
                    agentIds: ['main'],
                    archived: false,
                    displayName: 'Planning',
                },
            },
            title: 'Planning',
        });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'main',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'agent:main:tavern:channel:cht_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(getChat('cht_1')?.metadata).toEqual({
            runtime: {
                source: 'tavern',
            },
            sessionKeys: ['agent:main:tavern:channel:cht_1'],
            tavern: {
                agentIds: ['main'],
                archived: false,
                displayName: 'Planning',
            },
        });
    });
});

function createRelaySocket() {
    const handlers = new Map<string, (data?: unknown) => void>();
    const sent: Array<{
        kind: 'inbound-message';
        conversation: {
            groupChannel?: string;
            groupSubject?: string;
            groupSystemPrompt?: string;
            id: string;
            kind: string;
            label: string | null;
        };
        message: {
            id: string;
            sequence?: number;
        };
        recentMessages?: Array<{ body: string; messageId?: string }>;
        requestId: string;
        turnId?: string;
    }> = [];
    const value = {
        on(event: string, handler: (data?: unknown) => void) {
            handlers.set(event, handler);
        },
        readyState: 1,
        send(data: string, callback?: (error?: Error) => void) {
            sent.push(JSON.parse(data));
            callback?.();
        },
    };

    return {
        close() {
            handlers.get('close')?.();
        },
        emitMessage(payload: unknown) {
            handlers.get('message')?.(JSON.stringify(payload));
        },
        sent,
        value: value as never,
    };
}

function messageInput(id: string, nonce: string | undefined, content: string) {
    return {
        author_id: 'usr_1',
        content,
        id,
        ...(nonce ? { nonce } : {}),
        role: 'user' as const,
    };
}
