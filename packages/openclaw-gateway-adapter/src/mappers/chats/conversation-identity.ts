import type { AgentRuntimeChat } from '@tavern/agent-runtime-protocol';
import { readString } from '../../gateway/records.ts';
import { resolveOpenClawDiscordConversationIdentity } from '../../platforms/discord/conversation.ts';
import { resolveOpenClawTavernConversationIdentity } from '../../platforms/tavern/conversation.ts';
import type { OpenClawConversationIdentity } from '../../platforms/types.ts';
import { parseOpenClawSessionKey } from '../sessions/session-key.ts';

export function resolveOpenClawConversationIdentity(input: {
    record: Record<string, unknown>;
    sessionKey: string;
    sessionTitle?: string | null;
}) {
    const keyParts = parseOpenClawSessionKey(input.sessionKey);
    // Chat identity is conversation-first: delivery target, structured session key,
    // spawned parent chat, then bare OpenClaw fields before falling back to internal.
    const tavern = resolveOpenClawTavernConversationIdentity({
        keyParts,
        record: input.record,
        sessionKey: input.sessionKey,
        sessionTitle: input.sessionTitle,
    });

    if (tavern) {
        return tavern;
    }

    const discord = resolveOpenClawDiscordConversationIdentity({
        keyParts,
        record: input.record,
        resolveParent: (parentKey, title) =>
            resolveFromStructuredSessionKey(parentKey) ??
            resolveOpenClawConversationIdentity({
                record: {},
                sessionKey: parentKey,
                sessionTitle: title,
            }),
        sessionKey: input.sessionKey,
        sessionTitle: input.sessionTitle,
    });

    if (discord) {
        return discord;
    }

    const delivery = resolveFromDeliveryFields(input.record);

    if (delivery) {
        return delivery;
    }

    const fromKey = resolveFromStructuredSessionKey(input.sessionKey);

    if (fromKey) {
        return fromKey;
    }

    const fromParent = resolveFromSpawnedParent(input.record);

    if (fromParent) {
        return fromParent;
    }

    const bareFields = resolveFromBareConversationFields(input.record);

    if (bareFields) {
        return bareFields;
    }

    return resolveInternalConversation(input.sessionKey, input.record, input.sessionTitle);
}

function resolveFromDeliveryFields(
    record: Record<string, unknown>
): OpenClawConversationIdentity | null {
    const target = readDeliveryTarget(record);

    if (!target) {
        return null;
    }

    return buildExternalConversation({
        platform: target.platform ?? resolvePlatform(record) ?? 'openclaw',
        scope: target.scope,
        targetId: target.targetId,
    });
}

function resolveFromStructuredSessionKey(sessionKey: string): OpenClawConversationIdentity | null {
    const keyParts = parseOpenClawSessionKey(sessionKey);

    if (!(keyParts.platform && keyParts.scope && keyParts.target)) {
        return null;
    }

    return {
        id: `${keyParts.platform}:${keyParts.target}`,
        participants: [],
        platform: keyParts.platform,
        platformMetadata: null,
        scope: keyParts.scope,
        target: keyParts.target,
    };
}

function resolveFromSpawnedParent(
    record: Record<string, unknown>
): OpenClawConversationIdentity | null {
    const parentKey = readString(record, ['spawnedBy', 'parentSessionKey', 'parent']);

    return parentKey ? resolveFromStructuredSessionKey(parentKey) : null;
}

function resolveFromBareConversationFields(
    record: Record<string, unknown>
): OpenClawConversationIdentity | null {
    const kind = readString(record, ['kind']);
    const chatType = readString(record, ['chatType']);
    const platform = resolvePlatform(record) ?? 'openclaw';

    if (platform === 'discord') {
        return null;
    }

    const directTargetId = readString(record, ['lastTo', 'recipientId', 'directId', 'dmChannelId']);
    const groupedTargetId = readString(record, ['channelId', 'threadId']);

    if (kind === 'direct' && directTargetId) {
        return buildExternalConversation({
            platform,
            scope: 'dm',
            targetId: directTargetId,
        });
    }

    if ((kind === 'group' || chatType === 'channel' || chatType === 'group') && groupedTargetId) {
        return buildExternalConversation({
            platform,
            scope: chatType === 'channel' ? 'channel' : 'group',
            targetId: groupedTargetId,
        });
    }

    return null;
}

function resolveInternalConversation(
    sessionKey: string,
    record: Record<string, unknown>,
    _title?: string | null
): OpenClawConversationIdentity {
    const keyParts = parseOpenClawSessionKey(sessionKey);
    const platform = resolvePlatform(record) ?? resolveInternalPlatform(keyParts.platform);

    return {
        id: `openclaw:internal:${sessionKey}`,
        participants: [],
        platform,
        platformMetadata: null,
        scope: null,
        target: null,
    };
}

function buildExternalConversation(input: {
    platform: string;
    scope: Exclude<AgentRuntimeChat['scope'], null>;
    targetId: string;
}): OpenClawConversationIdentity {
    const target = `${input.scope}:${input.targetId}`;

    return {
        id: `${input.platform}:${target}`,
        participants: [],
        platform: input.platform,
        platformMetadata: null,
        scope: input.scope,
        target,
    };
}

function resolvePlatform(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);
    const deliveryContext = asNestedRecord(record.deliveryContext);

    return (
        readString(origin, ['provider', 'surface']) ??
        readString(deliveryContext, ['channel']) ??
        readString(record, ['lastChannel', 'platform', 'channel'])
    );
}

function resolveInternalPlatform(platform: string | null) {
    return platform && platform !== 'main' ? platform : 'openclaw';
}

function readDeliveryTarget(record: Record<string, unknown>) {
    const origin = asNestedRecord(record.origin);
    const deliveryContext = asNestedRecord(record.deliveryContext);
    const values = [
        readString(origin, ['to', 'from']),
        readString(deliveryContext, ['to']),
        readString(record, ['lastTo']),
    ];

    for (const value of values) {
        const target = value ? parseDeliveryTarget(value) : null;

        if (target) {
            return target;
        }
    }

    return null;
}

function parseDeliveryTarget(value: string): {
    platform: string | null;
    scope: Exclude<AgentRuntimeChat['scope'], null>;
    targetId: string;
} | null {
    const parts = value.split(':').filter(Boolean);

    if (parts.length < 2) {
        return null;
    }

    const scopeIndex = parts.findIndex((part) => isTargetScope(part));

    if (scopeIndex < 0) {
        return null;
    }

    const scope = normalizeTargetScope(parts[scopeIndex]);
    const targetId = parts.slice(scopeIndex + 1).join(':');

    if (!targetId) {
        return null;
    }

    return {
        platform: scopeIndex > 0 ? parts[0] : null,
        scope,
        targetId,
    };
}

function isTargetScope(value: string) {
    return value === 'channel' || value === 'direct' || value === 'dm' || value === 'group';
}

function normalizeTargetScope(value: string): Exclude<AgentRuntimeChat['scope'], null> {
    return value === 'direct' ? 'dm' : (value as Exclude<AgentRuntimeChat['scope'], null>);
}

function asNestedRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
