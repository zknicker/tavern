import { deliverOutboundPayloads } from 'openclaw/plugin-sdk/outbound-runtime';
import { DEFAULT_ACCOUNT_ID, TAVERN_CHANNEL_ID } from './config.js';
import { persistDeliveredTurnMessage } from './failed-inbound-message.js';

export async function deliverTavernReplyPayload({ cfg, input, payload, runId, storePath, target }) {
    await deliverOutboundPayloads({
        accountId: DEFAULT_ACCOUNT_ID,
        cfg,
        channel: TAVERN_CHANNEL_ID,
        deps: {
            [TAVERN_CHANNEL_ID]: createTavernOutboundSender({
                input,
                runId,
                storePath,
            }),
        },
        payloads: [payload],
        session: {
            agentId: input.agentId,
            conversationType: 'group',
            key: input.sessionKey,
            policyKey: input.sessionKey,
            requesterAccountId: DEFAULT_ACCOUNT_ID,
            requesterSenderId: input.sender.id,
            requesterSenderName: input.sender.name,
        },
        to: target,
    });
}

function createTavernOutboundSender({ input, runId, storePath }) {
    let sequence = 0;

    return async ({ text }) => {
        const normalizedText = typeof text === 'string' ? text : '';
        sequence += 1;

        if (looksLikeDeliveredFailureNotice(normalizedText)) {
            await persistDeliveredTurnMessage({ input, storePath, text: normalizedText });
        }

        return {
            messageId: `${runId}:outbound:${sequence}`,
            timestamp: Date.now(),
        };
    };
}

function looksLikeDeliveredFailureNotice(text) {
    const normalized = String(text).trim();

    if (!normalized.startsWith('⚠️')) {
        return false;
    }

    return (
        normalized.includes('Please try again') ||
        normalized.includes('use /new') ||
        normalized.includes('Model login failed on the gateway') ||
        normalized.includes('Missing API key') ||
        normalized.includes('Context overflow') ||
        normalized.includes('Session history was corrupted') ||
        normalized.includes('Message ordering conflict')
    );
}
