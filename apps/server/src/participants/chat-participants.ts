import type { AgentRuntimeChat, AgentRuntimeChatParticipant } from '@tavern/agent-runtime-protocol';
import { upsertParticipantLabels, upsertParticipants } from '../storage/participants.ts';
import { normalizeObservedParticipantLabel } from './observed.ts';

export interface RuntimeParticipantSource {
    accountKey: string | null;
    externalId: string | null;
    label: string;
    normalizedLabel: string;
    participantId: string;
    provider: string;
}

export function resolveChatParticipantSourceIdentities(
    chat: Pick<AgentRuntimeChat, 'participants'>
): RuntimeParticipantSource[] {
    return resolveRuntimeParticipantSourceIdentities(chat.participants);
}

export function resolveRuntimeParticipantSourceIdentities(
    participants: AgentRuntimeChatParticipant[]
): RuntimeParticipantSource[] {
    return participants
        .filter((participant) => participant.type === 'participant')
        .flatMap((participant) => {
            const labels = [...new Set([participant.name, ...participant.observedLabels])];

            return labels.map((label) => {
                const normalizedLabel = normalizeObservedParticipantLabel(label);

                return {
                    accountKey: participant.accountKey,
                    externalId: participant.externalId,
                    label,
                    normalizedLabel,
                    participantId: participant.participantId,
                    provider: participant.platform,
                };
            });
        });
}

export async function syncChatParticipantsForRuntime(input: {
    chats: AgentRuntimeChat[];
    syncedAt: string;
}) {
    const identities = resolveBestChatParticipantSourceIdentities(input.chats);
    const observedIdentities = input.chats.flatMap((chat) =>
        resolveChatParticipantSourceIdentities(chat)
    );

    return await syncRuntimeParticipantIdentities({
        identities,
        observedIdentities,
        syncedAt: input.syncedAt,
    });
}

export async function syncRuntimeParticipantIdentities(input: {
    identities: RuntimeParticipantSource[];
    observedIdentities?: RuntimeParticipantSource[];
    syncedAt: string;
}) {
    if (input.identities.length === 0 && (input.observedIdentities?.length ?? 0) === 0) {
        return {
            synced: 0,
        };
    }

    await upsertParticipants(
        input.identities.map((identity) => ({
            accountKey: identity.accountKey,
            createdAt: input.syncedAt,
            externalId: identity.externalId,
            id: identity.participantId,
            lastSeenAt: input.syncedAt,
            observedName: identity.label,
            provider: identity.provider,
            updatedAt: input.syncedAt,
        }))
    );
    await upsertParticipantLabels(
        (input.observedIdentities ?? input.identities).map((identity) => ({
            createdAt: input.syncedAt,
            id: `${identity.participantId}:label:${encodeURIComponent(identity.normalizedLabel)}`,
            label: identity.label,
            lastSeenAt: input.syncedAt,
            normalizedLabel: identity.normalizedLabel,
            participantId: identity.participantId,
            updatedAt: input.syncedAt,
        }))
    );

    return {
        synced: input.identities.length,
    };
}

function resolveBestChatParticipantSourceIdentities(chats: AgentRuntimeChat[]) {
    const byParticipantId = new Map<string, RuntimeParticipantSource>();

    for (const chat of chats) {
        for (const identity of resolveChatParticipantSourceIdentities(chat)) {
            const existing = byParticipantId.get(identity.participantId);

            if (
                !existing ||
                scoreObservedLabel(identity.label) > scoreObservedLabel(existing.label)
            ) {
                byParticipantId.set(identity.participantId, identity);
            }
        }
    }

    return [...byParticipantId.values()];
}

function scoreObservedLabel(label: string) {
    let score = 0;

    if (/\s/u.test(label)) {
        score += 40;
    }

    if (/[A-Z]/u.test(label)) {
        score += 10;
    }

    if (/\buser\s+id:\d+\b/iu.test(label)) {
        score -= 120;
    }

    if (/^\d{6,}$/u.test(label)) {
        score -= 80;
    }

    score -= Math.min(label.length, 60);

    return score;
}
