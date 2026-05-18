import type { AgentRuntimeChat } from '@tavern/api';
import { readString } from '../../gateway/records.ts';
import type { OpenClawConversationIdentity } from '../types.ts';

const tavernChatIdPattern = /^cht_[A-Za-z0-9_-]+$/u;

interface TavernConversationInput {
    keyParts: {
        platform: string | null;
        scope: AgentRuntimeChat['scope'];
        target: string | null;
    };
    record: Record<string, unknown>;
    sessionKey: string;
    sessionTitle?: string | null;
}

export function resolveOpenClawTavernConversationIdentity(
    input: TavernConversationInput
): OpenClawConversationIdentity | null {
    const platform = resolveTavernPlatform(input.record, input.keyParts.platform);

    if (platform !== 'tavern') {
        return null;
    }

    const metadata = asNestedRecord(input.record.metadata);
    const tavernMetadata = asNestedRecord(metadata.tavern);
    const origin = asNestedRecord(input.record.origin);
    const deliveryContext = asNestedRecord(input.record.deliveryContext);
    const chatId = resolveTavernChatId({
        tavernMetadata,
        keyTarget: input.keyParts.target,
        record: input.record,
    });

    if (!chatId) {
        throw new Error('OpenClaw Tavern Messenger session is missing a stable Tavern chat id.');
    }

    const target = `chat:${chatId}`;
    const scope = readTavernScope(input.record);
    const conversationId =
        readString(input.record, ['conversationId']) ??
        readString(tavernMetadata, ['conversationId']) ??
        readString(origin, ['conversationId']) ??
        readString(deliveryContext, ['conversationId']);

    return {
        id: chatId,
        participants: [],
        platform: 'tavern',
        platformMetadata: {
            chatId,
            conversationId,
            observedLabels: uniqueStrings([
                input.sessionTitle ?? null,
                readString(input.record, ['displayName', 'name', 'label', 'subject']),
                readString(tavernMetadata, ['displayName', 'label']),
                readString(origin, ['label']),
            ]),
            provider: 'tavern',
            sourceRecords: [
                {
                    chatId,
                    clientMessageId:
                        readString(input.record, ['clientMessageId', 'messageId']) ??
                        readString(origin, ['clientMessageId', 'messageId']),
                    conversationId,
                    deliveryId:
                        readString(input.record, ['deliveryId']) ??
                        readString(origin, ['deliveryId']),
                    runId: readString(input.record, ['runId']) ?? readString(origin, ['runId']),
                    sessionKey: input.sessionKey,
                    source: buildSourceRecord({ tavernMetadata, deliveryContext, origin }),
                },
            ],
        },
        scope,
        target,
    };
}

function resolveTavernPlatform(record: Record<string, unknown>, keyPlatform: string | null) {
    const metadata = asNestedRecord(record.metadata);
    const tavernMetadata = asNestedRecord(metadata.tavern);
    const origin = asNestedRecord(record.origin);
    const deliveryContext = asNestedRecord(record.deliveryContext);
    const deliveryChannel = readString(deliveryContext, ['channel']);
    const lastChannel = readString(record, ['lastChannel', 'platform', 'channel']);

    if (keyPlatform === 'tavern' || deliveryChannel === 'tavern' || lastChannel === 'tavern') {
        return 'tavern';
    }

    if (Object.keys(tavernMetadata).length > 0) {
        return 'tavern';
    }

    return (
        readString(origin, ['provider', 'surface']) ?? deliveryChannel ?? lastChannel ?? keyPlatform
    );
}

function readTavernScope(record: Record<string, unknown>): AgentRuntimeChat['scope'] {
    const value = readString(record, ['scope', 'chatScope', 'kind']);

    return value === 'channel' || value === 'dm' || value === 'group' || value === 'topic'
        ? value
        : null;
}

function readTavernChatTarget(value: string | null) {
    if (!value) {
        return null;
    }

    const routeTarget = value.startsWith('channel:') ? value.slice('channel:'.length) : value;
    const chatTarget = routeTarget.startsWith('chat:')
        ? routeTarget.slice('chat:'.length)
        : routeTarget;

    return tavernChatIdPattern.test(chatTarget) ? chatTarget : null;
}

function resolveTavernChatId(input: {
    tavernMetadata: Record<string, unknown>;
    keyTarget: string | null;
    record: Record<string, unknown>;
}) {
    const candidates = [
        readString(input.record, ['chatId', 'tavernChatId']),
        readString(input.tavernMetadata, ['chatId', 'id']),
        input.keyTarget,
    ];

    for (const value of candidates) {
        const chatId = readTavernChatTarget(value);

        if (chatId) {
            return chatId;
        }
    }

    return null;
}

function buildSourceRecord(input: {
    tavernMetadata: Record<string, unknown>;
    deliveryContext: Record<string, unknown>;
    origin: Record<string, unknown>;
}) {
    const source = {
        tavern: input.tavernMetadata,
        deliveryContext: input.deliveryContext,
        origin: input.origin,
    };

    return Object.values(source).some((record) => Object.keys(record).length > 0) ? source : null;
}

function uniqueStrings(values: Array<string | null>) {
    return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function asNestedRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
