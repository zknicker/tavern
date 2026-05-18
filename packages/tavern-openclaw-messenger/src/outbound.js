import { randomUUID } from 'node:crypto';
import {
    createMessageReceiptFromOutboundResults,
    defineChannelMessageAdapter,
} from 'openclaw/plugin-sdk/channel-message';
import {
    buildTavernTarget,
    DEFAULT_ACCOUNT_ID,
    readChatIdFromTarget,
    TAVERN_CHANNEL_ID,
} from './config.js';

const deliveryContexts = new Map();

export const tavernMessageAdapter = defineChannelMessageAdapter({
    id: TAVERN_CHANNEL_ID,
    durableFinal: {
        capabilities: {
            messageSendingHooks: true,
            text: true,
        },
    },
    receive: {
        defaultAckPolicy: 'manual',
        supportedAckPolicies: ['manual'],
    },
    send: {
        text: sendTavernTextMessage,
    },
});

export function registerTavernDeliveryContext(input) {
    const key = getDeliveryContextKey({
        accountId: input.accountId,
        chatId: input.chatId,
    });
    const context = {
        agentId: input.agentId,
        chatId: input.chatId,
        deliverySequence: 0,
        markFinalReplySent: input.markFinalReplySent,
        runId: input.runId,
        sessionKey: input.sessionKey,
    };
    const stack = deliveryContexts.get(key) ?? [];

    stack.push(context);
    deliveryContexts.set(key, stack);

    return () => {
        const current = deliveryContexts.get(key) ?? [];
        const next = current.filter((entry) => entry !== context);

        if (next.length > 0) {
            deliveryContexts.set(key, next);
            return;
        }

        deliveryContexts.delete(key);
    };
}

export async function sendTavernTextMessage(ctx) {
    const target = buildTavernTarget(ctx.to);
    const chatId = readChatIdFromTarget(target);
    const sentAt = Date.now();
    const text = String(ctx.text ?? '');
    const deliveryContext = getCurrentDeliveryContext({
        accountId: ctx.accountId,
        chatId,
    });
    const messageId = deliveryContext ? nextMessageId(deliveryContext) : `msg_${randomUUID()}`;
    const deliveryId = deliveryContext
        ? currentDeliveryId(deliveryContext)
        : `del_${stripPrefix(messageId, 'msg_')}`;

    if (text.trim() && deliveryContext) {
        deliveryContext.markFinalReplySent?.();
        await requireTavernApi(ctx.context).createDelivery({
            agentId: deliveryContext.agentId,
            chatId,
            deliveryId,
            messageId,
            runId: deliveryContext.runId,
            sessionKey: deliveryContext.sessionKey,
            text,
            timestamp: new Date(sentAt).toISOString(),
        });
    }

    const receipt = createMessageReceiptFromOutboundResults({
        kind: 'text',
        results: [
            {
                channel: TAVERN_CHANNEL_ID,
                chatId,
                conversationId: chatId,
                messageId,
                timestamp: sentAt,
            },
        ],
        sentAt,
    });

    return {
        messageId,
        receipt,
    };
}

function requireTavernApi(context) {
    if (!context?.tavern) {
        throw new Error('Tavern Messenger requires a Tavern API client.');
    }
    return context.tavern;
}

function getCurrentDeliveryContext(input) {
    const stack = deliveryContexts.get(getDeliveryContextKey(input)) ?? [];
    return stack.at(-1) ?? null;
}

function getDeliveryContextKey(input) {
    return `${input.accountId ?? DEFAULT_ACCOUNT_ID}:${input.chatId}`;
}

function nextMessageId(deliveryContext) {
    deliveryContext.deliverySequence += 1;
    return `msg_${runSuffix(deliveryContext.runId)}_final_${deliveryContext.deliverySequence}`;
}

function currentDeliveryId(deliveryContext) {
    return `del_${runSuffix(deliveryContext.runId)}_final_${deliveryContext.deliverySequence}`;
}

function runSuffix(runId) {
    return stripPrefix(String(runId), 'run_');
}

function stripPrefix(value, prefix) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
