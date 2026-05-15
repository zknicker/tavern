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
    it('advertises Tavern chats as channel chats', () => {
        expect(tavernChannelPlugin.base.capabilities.chatTypes).toEqual(['channel']);
        expect(
            tavernChannelPlugin.base.messaging.parseExplicitTarget({
                raw: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            })
        ).toEqual({
            chatType: 'channel',
            to: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(tavernChannelPlugin.base.messaging.inferTargetChatType()).toBe('channel');
    });

    it('builds OpenClaw-native per-chat session routes for Tavern chats', () => {
        expect(
            buildTavernOutboundSessionRoute({
                accountId: 'default',
                agentId: 'blippy',
                cfg: { session: { dmScope: 'main' } },
                target: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            })
        ).toMatchObject({
            baseSessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            chatType: 'channel',
            from: 'tavern:default',
            peer: {
                id: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                kind: 'channel',
            },
            sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            to: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
    });

    it('exposes a channel message adapter backed by Tavern Gateway events', async () => {
        const broadcast = mock(() => undefined);
        const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const unregister = registerTavernDeliveryContext({
            accountId: 'default',
            agentId: 'blippy',
            chatId,
            context: { broadcast },
            runId: 'run-1',
            sessionKey: `agent:blippy:tavern:channel:${chatId}`,
        });

        try {
            const result = await tavernMessageAdapter.send.text({
                accountId: 'default',
                cfg: {},
                text: 'hello from core',
                to: `chat:${chatId}`,
            });

            expect(result.receipt.platformMessageIds).toEqual([result.messageId]);
            expect(broadcast.mock.calls[0]).toMatchObject([
                'plugin.tavern.message.created',
                {
                    agentId: 'blippy',
                    chatId,
                    runId: 'run-1',
                    sessionKey: `agent:blippy:tavern:channel:${chatId}`,
                    text: 'hello from core',
                },
                { dropIfSlow: true },
            ]);

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
});
