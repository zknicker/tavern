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
