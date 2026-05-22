import { DEFAULT_ACCOUNT_ID, TAVERN_CHANNEL_ID } from './config.js';
import { buildBodyForAgentWithMentions } from './mentions.js';
import { buildAcceptedTavernMetadata } from './message-identity.js';

export function buildTavernTurnContext({ input, runtime, target, timestamp }) {
    const acceptedMetadata = buildAcceptedTavernMetadata(input);
    const bodyForAgent = buildBodyForAgentWithMentions({
        metadata: acceptedMetadata,
        text: input.text,
    });

    return runtime.channel.turn.buildContext({
        channel: TAVERN_CHANNEL_ID,
        accountId: DEFAULT_ACCOUNT_ID,
        messageId: input.messageId,
        messageIdFull: input.messageId,
        timestamp,
        from: target,
        sender: {
            id: input.sender.id,
            name: input.sender.name,
        },
        conversation: {
            kind: input.conversationKind ?? 'channel',
            id: input.chatId,
            label: input.chatId,
            nativeChannelId: input.chatId,
            routePeer: {
                kind: 'channel',
                id: input.chatId,
            },
        },
        route: {
            agentId: input.agentId,
            accountId: DEFAULT_ACCOUNT_ID,
            routeSessionKey: input.sessionKey,
        },
        reply: {
            to: target,
            originatingTo: target,
            nativeChannelId: input.chatId,
        },
        access: {
            commands: {
                useAccessGroups: false,
                allowTextCommands: true,
                authorizers: [{ configured: true, allowed: true }],
            },
        },
        extra: {
            TavernMessageMetadata: acceptedMetadata,
        },
        message: {
            rawBody: input.text,
            bodyForAgent,
            commandBody: input.text,
            envelopeFrom: input.sender.name,
            inboundHistory: input.recentMessages,
            parentMessageId: input.parentMessageId,
            sequence: input.sequence,
            threadRootId: input.threadRootId,
        },
    });
}
