import { describe, expect, it, mock } from 'bun:test';
import { verifyChannelMessageAdapterCapabilityProofs } from 'openclaw/plugin-sdk/channel-message';

mock.module('openclaw/plugin-sdk/channel-core', () => ({
    buildChannelOutboundSessionRoute: (params) => {
        const sessionKey = `agent:${params.agentId}:${params.channel}:${params.peer.kind}:${params.peer.id}`;

        return {
            baseSessionKey: sessionKey,
            chatType: params.chatType,
            from: params.from,
            peer: params.peer,
            sessionKey,
            to: params.to,
        };
    },
    createChatChannelPlugin: (plugin) => plugin,
}));

mock.module('openclaw/plugin-sdk/channel-plugin-common', () => ({
    getChatChannelMeta: () => ({}),
}));

const { tavernChannelPlugin, buildTavernOutboundSessionRoute } = await import('./channel.js');
const { tavernMessageAdapter, registerTavernDeliveryContext } = await import('./outbound.js');
const { createTavernDirectoryAdapter, createTavernMessageActions } = await import('./actions.js');

describe('Tavern Messenger channel routing', () => {
    it('advertises Tavern chats as channel-only chats', () => {
        expect(tavernChannelPlugin.base.capabilities.chatTypes).toEqual(['channel']);
        expect(
            tavernChannelPlugin.base.messaging.parseExplicitTarget({
                raw: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            })
        ).toEqual({
            chatType: 'channel',
            to: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(tavernChannelPlugin.base.messaging.inferTargetChatType()).toBe('channel');
    });

    it('builds OpenClaw-native per-chat session routes for Tavern chats', () => {
        expect(
            buildTavernOutboundSessionRoute({
                accountId: 'default',
                agentId: 'blippy',
                cfg: { session: { dmScope: 'main' } },
                target: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            })
        ).toMatchObject({
            baseSessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            chatType: 'channel',
            from: 'tavern:default',
            peer: {
                id: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                kind: 'channel',
            },
            sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            to: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
    });

    it('exposes a channel message adapter backed by Tavern Gateway events', async () => {
        const tavern = {
            createDelivery: mock(async (input) => ({
                cursor: '1',
                id: input.deliveryId,
                idempotent: false,
                message: {
                    id: input.messageId,
                },
            })),
        };
        const chatId = 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const unregister = registerTavernDeliveryContext({
            accountId: 'default',
            agentId: 'blippy',
            chatId,
            context: { tavern },
            runId: 'run_1',
            sessionKey: `agent:blippy:tavern:channel:${chatId}`,
        });

        try {
            const result = await tavernMessageAdapter.send.text({
                accountId: 'default',
                cfg: {},
                context: { tavern },
                text: 'hello from core',
                to: `chat:${chatId}`,
            });

            expect(result.receipt.platformMessageIds).toEqual([result.messageId]);
            expect(tavern.createDelivery.mock.calls[0][0]).toMatchObject({
                agentId: 'blippy',
                chatId,
                deliveryId: 'del_1_final_1',
                messageId: 'msg_1_final_1',
                runId: 'run_1',
                sessionKey: `agent:blippy:tavern:channel:${chatId}`,
                text: 'hello from core',
            });
            unregister();

            await expect(
                verifyChannelMessageAdapterCapabilityProofs({
                    adapterName: 'tavern',
                    adapter: tavernMessageAdapter,
                    proofs: {
                        messageSendingHooks: () => {
                            expect(
                                tavernMessageAdapter.durableFinal.capabilities.messageSendingHooks
                            ).toBe(true);
                        },
                        text: async () => {
                            const proof = await tavernMessageAdapter.send.text({
                                accountId: 'default',
                                cfg: {},
                                text: 'proof',
                                to: `chat:${chatId}`,
                            });

                            expect(proof.receipt.platformMessageIds).toContain(proof.messageId);
                        },
                    },
                })
            ).resolves.toContainEqual({ capability: 'text', status: 'verified' });
        } finally {
            unregister();
        }
    });

    it('advertises Tavern history actions and prompt hints for the shared message tool', () => {
        const actions = tavernChannelPlugin.base.actions;

        expect(actions.describeMessageTool().actions).toEqual(['send', 'read', 'search']);
        expect(actions.resolveExecutionMode({ action: 'read' })).toBe('gateway');
        expect(actions.resolveExecutionMode({ action: 'search' })).toBe('gateway');
        expect(actions.resolveExecutionMode({ action: 'send' })).toBe('local');
        expect(tavernChannelPlugin.base.agentPrompt.messageToolHints().join('\n')).toContain(
            'send`, `read`, and `search`'
        );
    });

    it('reads latest Tavern chat history from canonical messages', async () => {
        const api = createHistoryApi();
        const actions = createTavernMessageActions({ getApi: () => api });

        const result = await actions.handleAction({
            action: 'read',
            params: { limit: 5, target: 'chat:cht_1' },
            toolContext: {},
        });

        expect(result.details.messages).toEqual([{ id: 'msg_25', sequence: 25 }]);
        expect(api.getChat).toHaveBeenCalledWith('cht_1');
        expect(api.listMessages).toHaveBeenCalledWith('cht_1', {
            afterSequence: 25,
            limit: 5,
        });
    });

    it('reads Tavern chat history before, after, and around message cursors', async () => {
        const api = createHistoryApi();
        const actions = createTavernMessageActions({ getApi: () => api });

        await actions.handleAction({
            action: 'read',
            params: { before: 'msg_7', limit: 3, target: 'cht_1' },
            toolContext: {},
        });
        await actions.handleAction({
            action: 'read',
            params: { after: 'msg_4', limit: 2, target: 'cht_1' },
            toolContext: {},
        });
        await actions.handleAction({
            action: 'read',
            params: { around: 10, limit: 4, target: 'cht_1' },
            toolContext: {},
        });

        expect(api.getMessage.mock.calls.map((call) => call[0])).toEqual(['msg_7', 'msg_4']);
        expect(api.listMessages.mock.calls).toEqual([
            [
                'cht_1',
                {
                    afterSequence: 3,
                    beforeSequence: 7,
                    limit: 3,
                },
            ],
            ['cht_1', { afterSequence: 4, limit: 2 }],
            ['cht_1', { afterSequence: 7, limit: 4 }],
        ]);
    });

    it('searches Tavern chat history through the canonical chat API', async () => {
        const api = createHistoryApi();
        const actions = createTavernMessageActions({ getApi: () => api });

        const result = await actions.handleAction({
            action: 'search',
            params: { limit: 2, query: 'podcast', target: 'chat:cht_1' },
            toolContext: {},
        });

        expect(api.searchMessages).toHaveBeenCalledWith('cht_1', {
            limit: 2,
            query: 'podcast',
        });
        expect(result.details).toMatchObject({
            messages: [{ id: 'msg_search_1', sequence: 9 }],
            ok: true,
        });
    });

    it('resolves named Tavern chat targets for history actions', async () => {
        const api = createHistoryApi();
        const actions = createTavernMessageActions({ getApi: () => api });

        await actions.handleAction({
            action: 'search',
            params: { query: 'launch', target: '#general' },
            toolContext: {},
        });

        expect(api.listChats).toHaveBeenCalledWith({ limit: 500 });
        expect(api.searchMessages).toHaveBeenCalledWith('cht_1', {
            limit: 20,
            query: 'launch',
        });
    });

    it('lists Tavern chats through the OpenClaw directory adapter', async () => {
        const api = {
            listChats: mock(async () => ({
                chats: [
                    {
                        id: 'cht_general',
                        last_message_sequence: 12,
                        pinned: true,
                        title: '#general',
                    },
                    {
                        id: 'cht_random',
                        last_message_sequence: 1,
                        pinned: false,
                        title: 'random',
                    },
                ],
            })),
        };
        const directory = createTavernDirectoryAdapter({ getApi: () => api });

        const groups = await directory.listGroups({ query: '#general' });

        expect(api.listChats).toHaveBeenCalledWith({ limit: 500 });
        expect(groups).toEqual([
            {
                handle: '#general',
                id: 'cht_general',
                kind: 'channel',
                name: '#general',
                rank: 1,
                raw: {
                    lastMessageSequence: 12,
                    pinned: true,
                },
            },
        ]);
    });

    it('uses the registered delivery context when OpenClaw omits send context', async () => {
        const tavern = {
            createDelivery: mock(async (input) => ({
                cursor: '1',
                id: input.deliveryId,
                idempotent: false,
                message: {
                    id: input.messageId,
                },
            })),
        };
        const chatId = 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const unregister = registerTavernDeliveryContext({
            accountId: 'default',
            agentId: 'blippy',
            chatId,
            context: { tavern },
            requestMessageId: 'msg_request',
            runId: 'run_1',
            sessionKey: `agent:blippy:tavern:channel:${chatId}`,
        });

        try {
            await tavernMessageAdapter.send.text({
                accountId: 'default',
                cfg: {},
                text: 'hello from core',
                to: `chat:${chatId}`,
            });

            expect(tavern.createDelivery.mock.calls[0][0]).toMatchObject({
                chatId,
                requestMessageId: 'msg_request',
                text: 'hello from core',
            });
        } finally {
            unregister();
        }
    });

    it('strips runtime notice prefixes when OpenClaw sends through the channel adapter', async () => {
        const tavern = {
            createDelivery: mock(async (input) => ({
                cursor: '1',
                id: input.deliveryId,
                idempotent: false,
                message: {
                    id: input.messageId,
                },
            })),
            updateTurnActivity: mock(async (turn, input = {}) => ({
                ...turn,
                ...input,
            })),
        };
        const chatId = 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const unregister = registerTavernDeliveryContext({
            accountId: 'default',
            agentId: 'blippy',
            chatId,
            context: { tavern },
            requestMessageId: 'msg_request',
            runId: 'run_1',
            sessionKey: `agent:blippy:tavern:channel:${chatId}`,
            startedAt: '2026-06-01T17:59:40.985Z',
        });

        try {
            await tavernMessageAdapter.send.text({
                accountId: 'default',
                cfg: {},
                text: [
                    '🧭 New session: 4851269c-9b4c-4bf5-b9f0-169f56ed5376',
                    '',
                    'Today is Monday, June 1, 2026.',
                ].join('\n'),
                to: `chat:${chatId}`,
            });

            expect(tavern.createDelivery).toHaveBeenCalledTimes(1);
            expect(tavern.createDelivery.mock.calls[0][0]).toMatchObject({
                chatId,
                requestMessageId: 'msg_request',
                text: 'Today is Monday, June 1, 2026.',
            });
            expect(tavern.createDelivery.mock.calls[0][0].text).not.toContain('New session');
            expect(
                tavern.updateTurnActivity.mock.calls.map(([, input]) => input?.step)
            ).toContainEqual(
                expect.objectContaining({
                    id: 'act_runtime_notice_new_session_4851269c-9b4c-4bf5-b9f0-169f56ed5376',
                    kind: 'custom',
                    metadata: expect.objectContaining({
                        detail: '4851269c-9b4c-4bf5-b9f0-169f56ed5376',
                        runtime: expect.objectContaining({
                            notice: expect.objectContaining({
                                kind: 'new_session',
                                sessionId: '4851269c-9b4c-4bf5-b9f0-169f56ed5376',
                            }),
                        }),
                    }),
                    title: 'Started new session',
                })
            );
        } finally {
            unregister();
        }
    });
});

function createHistoryApi() {
    return {
        getChat: mock(async () => ({ id: 'cht_1', last_message_sequence: 30 })),
        getMessage: mock(async (id) => ({
            chat_id: 'cht_1',
            id,
            sequence: Number(id.replace('msg_', '')),
        })),
        listChats: mock(async () => ({
            chats: [
                {
                    id: 'cht_1',
                    last_message_sequence: 30,
                    pinned: true,
                    title: '#general',
                },
            ],
        })),
        listMessages: mock(async (_chatId, input) => ({
            messages: [{ id: `msg_${input.afterSequence}`, sequence: input.afterSequence }],
            next_sequence: null,
        })),
        searchMessages: mock(async () => ({
            messages: [{ id: 'msg_search_1', sequence: 9 }],
            next_sequence: null,
        })),
    };
}
