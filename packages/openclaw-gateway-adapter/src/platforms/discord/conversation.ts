import { readString } from '../../gateway/records.ts';
import type { OpenClawConversationIdentity } from '../types.ts';
import { buildDiscordParticipant, extractDiscordUserId } from './participant.ts';

interface DiscordConversationInput {
    keyParts: {
        agentId: string | null;
        platform: string | null;
        scope: DiscordScope | null;
        target: string | null;
    };
    record: Record<string, unknown>;
    resolveParent: (parentKey: string, title: string | null) => OpenClawConversationIdentity | null;
    sessionKey: string;
    sessionTitle?: string | null;
}

type DiscordScope = 'channel' | 'dm' | 'group' | 'topic';

export function resolveOpenClawDiscordConversationIdentity(
    input: DiscordConversationInput
): OpenClawConversationIdentity | null {
    const platform = resolveDiscordPlatform(input.record, input.keyParts.platform);

    if (platform !== 'discord') {
        return null;
    }

    const agentId = input.keyParts.agentId ?? readString(input.record, ['agentId', 'agent']);
    const title = input.sessionTitle ?? readDiscordDisplayName(input.record);
    const deliveryTarget = readDiscordDeliveryTarget(input.record);

    if (deliveryTarget) {
        return buildDiscordConversation({
            agentId,
            record: input.record,
            scope: deliveryTarget.scope,
            sessionKey: input.sessionKey,
            targetId: deliveryTarget.targetId,
            title,
        });
    }

    if (input.keyParts.scope && input.keyParts.target) {
        return buildDiscordConversation({
            agentId,
            record: input.record,
            scope: input.keyParts.scope,
            sessionKey: input.sessionKey,
            targetId: input.keyParts.target.replace(
                new RegExp(`^${input.keyParts.scope}:`, 'u'),
                ''
            ),
            title,
        });
    }

    const parentKey = readString(input.record, ['spawnedBy', 'parentSessionKey', 'parent']);

    return parentKey ? input.resolveParent(parentKey, title) : null;
}

function buildDiscordConversation(input: {
    agentId: string | null;
    record: Record<string, unknown>;
    scope: DiscordScope;
    sessionKey: string;
    targetId: string;
    title: string | null;
}): OpenClawConversationIdentity {
    if (input.scope === 'dm') {
        if (!input.agentId) {
            throw new Error('OpenClaw Discord DM session is missing a stable agent id.');
        }

        const agentId = input.agentId;
        const target = `dm:${input.targetId}`;
        const id = `discord:agent:${agentId}:${target}`;
        const participant = buildDiscordParticipant({
            label: input.title,
            observedLabels: readDiscordObservedLabels(input.record),
            targetId: input.targetId,
        });

        return {
            id,
            participants: participant ? [participant] : [],
            platform: 'discord',
            platformMetadata: buildDiscordMetadata(input),
            scope: 'dm',
            target,
        };
    }

    const target = `${input.scope}:${input.targetId}`;

    return {
        id: `discord:${target}`,
        participants: [],
        platform: 'discord',
        platformMetadata: buildDiscordMetadata(input),
        scope: input.scope,
        target,
    };
}

function buildDiscordMetadata(input: {
    record: Record<string, unknown>;
    scope: DiscordScope;
    sessionKey: string;
    targetId: string;
}) {
    const origin = asNestedRecord(input.record.origin);
    const deliveryContext = asNestedRecord(input.record.deliveryContext);
    const userId = input.scope === 'dm' ? extractDiscordUserId(input.targetId) : null;

    return {
        accountIds: uniqueStrings([
            readString(origin, ['accountId']),
            readString(deliveryContext, ['accountId']),
            readString(input.record, ['accountId']),
        ]),
        channel:
            input.scope === 'channel'
                ? {
                      id: input.targetId,
                      name: readDiscordChannelName(input.record),
                  }
                : null,
        dm: userId ? { userId } : null,
        guild: readDiscordGuild(input.record),
        observedLabels: uniqueStrings([
            readString(input.record, ['displayName', 'name', 'label', 'subject']),
            readString(origin, ['label']),
            readString(input.record, ['groupChannel', 'channelName', 'threadName']),
        ]),
        provider: 'discord' as const,
        sourceRecords: [
            {
                chatType: readString(input.record, ['chatType']),
                deliveryContext: Object.keys(deliveryContext).length > 0 ? deliveryContext : null,
                displayName: readString(input.record, ['displayName', 'name', 'label', 'subject']),
                kind: readString(input.record, ['kind']),
                lastChannel: readString(input.record, ['lastChannel', 'platform', 'channel']),
                lastTo: readString(input.record, ['lastTo']),
                origin: Object.keys(origin).length > 0 ? origin : null,
                sessionKey: input.sessionKey,
            },
        ],
        thread:
            input.scope === 'topic'
                ? {
                      id: input.targetId,
                      name: readString(input.record, ['threadName', 'topicName']),
                  }
                : null,
    };
}

function readDiscordObservedLabels(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);

    return uniqueStrings([
        readString(record, ['displayName', 'name', 'label', 'subject']),
        readString(origin, ['label']),
    ]);
}

function readDiscordGuild(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);
    const guildId =
        readString(record, ['guildId', 'serverId']) ??
        readString(origin, ['guildId', 'serverId']) ??
        readGuildIdFromDisplayName(readString(record, ['displayName']));

    if (!guildId) {
        return null;
    }

    return {
        id: guildId,
        name: readString(record, ['guildName', 'serverName']) ?? readString(origin, ['guildName']),
    };
}

function readDiscordChannelName(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);

    return (
        readString(record, ['groupChannel', 'channelName']) ??
        readString(origin, ['channelName']) ??
        readChannelNameFromLabel(readString(origin, ['label'])) ??
        readChannelNameFromDisplayName(readString(record, ['displayName']))
    );
}

function readGuildIdFromDisplayName(value: string | null) {
    return /^discord:(\d+)#/u.exec(value ?? '')?.[1] ?? null;
}

function readChannelNameFromDisplayName(value: string | null) {
    return /^discord:\d+#(.+)$/u.exec(value ?? '')?.[1] ?? null;
}

function readChannelNameFromLabel(value: string | null) {
    return /(^|\s)(#[^\s]+)(\s|$)/u.exec(value ?? '')?.[2] ?? null;
}

function uniqueStrings(values: Array<string | null>) {
    return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function readDiscordDeliveryTarget(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);
    const deliveryContext = asNestedRecord(record.deliveryContext);
    const direct = readString(record, ['kind', 'chatType']) === 'direct';
    const values = [
        readString(origin, ['to']),
        readString(deliveryContext, ['to']),
        readString(record, ['lastTo']),
        readString(origin, ['from']),
    ];

    for (const value of values) {
        const target = value ? parseDiscordDeliveryTarget(value, direct) : null;

        if (target) {
            return target;
        }
    }

    return null;
}

function parseDiscordDeliveryTarget(value: string, direct: boolean) {
    const parts = value.split(':').filter(Boolean);
    const scopeIndex = parts.findIndex((part) => isDiscordScope(part));

    if (scopeIndex >= 0) {
        const scope = normalizeDiscordScope(parts[scopeIndex] as DiscordScope | 'direct');
        const targetId = parts.slice(scopeIndex + 1).join(':');

        return targetId ? { scope, targetId } : null;
    }

    if (direct && parts[0] === 'user' && parts[1]) {
        return {
            scope: 'dm' as const,
            targetId: parts.join(':'),
        };
    }

    return null;
}

function resolveDiscordPlatform(record: Record<string, unknown>, keyPlatform: string | null) {
    const origin = asNestedRecord(record.origin);
    const deliveryContext = asNestedRecord(record.deliveryContext);

    return (
        readString(origin, ['provider', 'surface']) ??
        readString(deliveryContext, ['channel']) ??
        readString(record, ['lastChannel', 'platform', 'channel']) ??
        keyPlatform
    );
}

function readDiscordDisplayName(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);

    return (
        readString(record, ['displayName', 'name', 'label', 'subject']) ??
        readString(origin, ['label'])
    );
}

function isDiscordScope(value: string) {
    return (
        value === 'channel' ||
        value === 'direct' ||
        value === 'dm' ||
        value === 'group' ||
        value === 'topic'
    );
}

function normalizeDiscordScope(value: DiscordScope | 'direct'): DiscordScope {
    return value === 'direct' ? 'dm' : value;
}

function asNestedRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
