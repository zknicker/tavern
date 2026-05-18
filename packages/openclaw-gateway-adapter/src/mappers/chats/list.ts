import {
    type AgentRuntimeChatList,
    type AgentRuntimeChatParticipant,
    type AgentRuntimeChatPlatformMetadata,
    agentRuntimeChatListSchema,
} from '@tavern/api';
import { asRecord, readArray } from '../../gateway/records.ts';
import { mapOpenClawSessionRecord } from '../sessions/shared.ts';
import { resolveOpenClawConversationIdentity } from './conversation-identity.ts';

export function mapOpenClawChatsFromSessions(input: unknown): AgentRuntimeChatList {
    const record = asRecord(input);
    const rawSessions = readArray(record.sessions ?? record.items ?? input);
    const chatsById = new Map<string, AgentRuntimeChatList['chats'][number]>();

    for (const rawSession of rawSessions) {
        const rawRecord = asRecord(rawSession);
        const session = mapOpenClawSessionRecord(rawSession);

        if (session.platform === 'tavern') {
            continue;
        }

        const identity = resolveOpenClawConversationIdentity({
            record: rawRecord,
            sessionKey: session.key,
            sessionTitle: session.title,
        });
        const existing = chatsById.get(identity.id);

        if (existing) {
            existing.bindings = mergeChatBindings(existing.bindings, [
                { agentId: session.agentId },
            ]);
            existing.participants = mergeChatParticipants(existing.participants, [
                { agentId: session.agentId, type: 'agent' },
                ...identity.participants,
            ]);
            existing.metadata = {
                ...existing.metadata,
                sessionKeys: [...readMetadataSessionKeys(existing.metadata), session.key].sort(),
            };
            existing.platformMetadata = mergePlatformMetadata(
                existing.platformMetadata,
                identity.platformMetadata
            );
            continue;
        }

        chatsById.set(identity.id, {
            bindingId: null,
            bindings: [{ agentId: session.agentId }],
            id: identity.id,
            inboundMode: 'active' as const,
            metadata: {
                sessionKeys: [session.key],
            },
            parentTarget: null,
            participants: mergeChatParticipants(
                [],
                [{ agentId: session.agentId, type: 'agent' }, ...identity.participants]
            ),
            platform: identity.platform,
            platformMetadata: identity.platformMetadata,
            requiresTrigger: false,
            scope: identity.scope,
            target: identity.target,
            trigger: null,
        });
    }

    return agentRuntimeChatListSchema.parse({
        chats: [...chatsById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    });
}

function mergePlatformMetadata(
    existing: AgentRuntimeChatPlatformMetadata,
    next: AgentRuntimeChatPlatformMetadata
): AgentRuntimeChatPlatformMetadata {
    if (!(existing && next)) {
        return existing ?? next;
    }

    if (existing.provider === 'tavern' && next.provider === 'tavern') {
        return {
            ...existing,
            observedLabels: uniqueStrings([...existing.observedLabels, ...next.observedLabels]),
            sourceRecords: [...existing.sourceRecords, ...next.sourceRecords].sort((left, right) =>
                left.sessionKey.localeCompare(right.sessionKey)
            ),
        };
    }

    if (existing.provider !== 'discord' || next.provider !== 'discord') {
        return existing;
    }

    return {
        ...existing,
        accountIds: uniqueStrings([...existing.accountIds, ...next.accountIds]),
        channel: existing.channel ?? next.channel,
        dm: existing.dm ?? next.dm,
        guild: existing.guild ?? next.guild,
        observedLabels: uniqueStrings([...existing.observedLabels, ...next.observedLabels]),
        sourceRecords: [...existing.sourceRecords, ...next.sourceRecords].sort((left, right) =>
            left.sessionKey.localeCompare(right.sessionKey)
        ),
        thread: existing.thread ?? next.thread,
    };
}

function uniqueStrings(values: string[]) {
    return [...new Set(values)].sort();
}

function mergeChatBindings(
    existing: AgentRuntimeChatList['chats'][number]['bindings'],
    next: AgentRuntimeChatList['chats'][number]['bindings']
) {
    return [
        ...new Map([...existing, ...next].map((binding) => [binding.agentId, binding])).values(),
    ].sort((left, right) => left.agentId.localeCompare(right.agentId));
}

function mergeChatParticipants(
    existing: AgentRuntimeChatParticipant[],
    next: AgentRuntimeChatParticipant[]
) {
    const participantsByKey = new Map<string, AgentRuntimeChatParticipant>();

    for (const participant of [...existing, ...next]) {
        participantsByKey.set(getChatParticipantKey(participant), participant);
    }

    return [...participantsByKey.values()].sort((left, right) =>
        getChatParticipantKey(left).localeCompare(getChatParticipantKey(right))
    );
}

function getChatParticipantKey(participant: AgentRuntimeChatParticipant) {
    return participant.type === 'agent'
        ? `agent:${participant.agentId}`
        : `participant:${participant.participantId}`;
}

function readMetadataSessionKeys(metadata: Record<string, unknown>) {
    return Array.isArray(metadata.sessionKeys)
        ? metadata.sessionKeys.filter((value): value is string => typeof value === 'string')
        : [];
}
