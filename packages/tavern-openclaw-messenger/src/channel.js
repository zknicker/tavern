import {
    buildChannelOutboundSessionRoute,
    createChatChannelPlugin,
} from 'openclaw/plugin-sdk/channel-core';
import { getChatChannelMeta } from 'openclaw/plugin-sdk/channel-plugin-common';
import {
    buildTavernPeerId,
    buildTavernTarget,
    DEFAULT_ACCOUNT_ID,
    readChatIdFromTarget,
    resolveTavernAccount,
    TAVERN_CHANNEL_ID,
} from './config.js';
import { TAVERN_CHANNEL_META } from './meta.js';
import { tavernMessageAdapter } from './outbound.js';
import { startTavernGatewayAccount } from './runtime-relay.js';

const meta = {
    ...getChatChannelMeta(TAVERN_CHANNEL_ID),
    ...TAVERN_CHANNEL_META,
};

export const tavernChannelPlugin = createChatChannelPlugin({
    base: {
        id: TAVERN_CHANNEL_ID,
        meta,
        capabilities: {
            chatTypes: ['channel'],
        },
        reload: {
            configPrefixes: ['channels.tavern'],
        },
        config: {
            listAccountIds: () => [DEFAULT_ACCOUNT_ID],
            resolveAccount: (cfg, accountId) => resolveTavernAccount(cfg, accountId),
            defaultAccountId: () => DEFAULT_ACCOUNT_ID,
            hasConfiguredState: () => true,
            isConfigured: () => true,
            resolveAllowFrom: () => ['*'],
            resolveDefaultTo: () => null,
        },
        messaging: {
            normalizeTarget: buildTavernTarget,
            parseExplicitTarget: ({ raw }) => ({
                chatType: 'channel',
                to: buildTavernTarget(raw),
            }),
            inferTargetChatType: () => 'channel',
            targetResolver: {
                looksLikeId: (raw) => raw.trim().length > 0,
                hint: '<tavern-chat-uuid>',
            },
            resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target }) =>
                buildTavernOutboundSessionRoute({
                    accountId,
                    agentId,
                    cfg,
                    target,
                }),
            resolveSessionConversation: ({ rawId }) => {
                const chatId = readChatIdFromTarget(rawId);
                return {
                    id: chatId,
                    baseConversationId: chatId,
                    parentConversationCandidates: [chatId],
                };
            },
        },
        gateway: {
            startAccount: async (ctx) => {
                await startTavernGatewayAccount(ctx);
            },
        },
        message: tavernMessageAdapter,
    },
});

export function buildTavernOutboundSessionRoute({ accountId, agentId, cfg, target }) {
    const normalizedTarget = buildTavernTarget(target);
    const peerId = buildTavernPeerId(normalizedTarget);

    return buildChannelOutboundSessionRoute({
        accountId: accountId ?? DEFAULT_ACCOUNT_ID,
        agentId,
        cfg: cfg ?? {},
        channel: TAVERN_CHANNEL_ID,
        from: `tavern:${accountId ?? DEFAULT_ACCOUNT_ID}`,
        peer: {
            id: peerId,
            kind: 'channel',
        },
        chatType: 'channel',
        to: normalizedTarget,
    });
}
