import { type AgentLookup, resolveObservedActor } from '../participants/observed.ts';
import { deriveAgentId, type LiveSession } from '../sessions/messages.ts';
import {
    resolveParticipantIdsForObservedSenders,
    upsertParticipantLabels,
    upsertParticipants,
} from '../storage/participants.ts';
import { loadAgentLookup } from '../storage/session-activity/shared.ts';
import {
    deriveRuntime,
    getString,
    isRecord,
    type SessionActivitySnapshot,
} from './snapshot-shared.ts';

interface SessionActorContext {
    accountKey: string | null;
    provider: string | null;
}

interface ParticipantCandidate {
    accountKey: string | null;
    externalId: string | null;
    messageId: string;
    normalizedLabel: string;
    observedName: string;
    participantId: string;
    provider: string;
    senderLabel: string;
    timestamp: string;
}

const sessionParticipantlessRuntimes = new Set(['acp', 'cli', 'cron', 'main', 'subagent']);

function getSessionActorContext(session: LiveSession): SessionActorContext {
    const rawSession = session as unknown as Record<string, unknown>;
    const deliveryContext = isRecord(rawSession.deliveryContext)
        ? rawSession.deliveryContext
        : null;
    const channel = getString(deliveryContext?.channel);

    if (channel) {
        return {
            accountKey:
                getString(deliveryContext?.bindingId) ??
                getString(deliveryContext?.connectionId) ??
                null,
            provider: channel,
        };
    }

    const runtime = deriveRuntime(session);

    if (!runtime || sessionParticipantlessRuntimes.has(runtime)) {
        return {
            accountKey: null,
            provider: null,
        };
    }

    return {
        accountKey: null,
        provider: runtime,
    };
}

function resolveMessageActor(input: {
    agentLookup: AgentLookup;
    context: SessionActorContext | null;
    message: SessionActivitySnapshot['messages'][number];
}) {
    if (input.message.role === 'assistant') {
        const agentId = deriveAgentId(input.message.sessionKey);

        return agentId
            ? {
                  actorId: input.agentLookup.byId.get(agentId)?.agentId ?? agentId,
                  actorKind: 'agent' as const,
              }
            : null;
    }

    if (input.message.role !== 'user' || !input.message.senderLabel) {
        return null;
    }

    const observedActor = resolveObservedActor({
        accountKey: input.context?.accountKey ?? null,
        agentLookup: input.agentLookup,
        provider: input.context?.provider ?? 'unknown',
        senderLabel: input.message.senderLabel,
    });

    if (!observedActor) {
        return null;
    }

    if (observedActor.actorType === 'agent') {
        return {
            actorId: observedActor.agentId,
            actorKind: 'agent' as const,
        };
    }

    if (!input.context?.provider) {
        return null;
    }

    return {
        accountKey: input.context.accountKey,
        actorId: observedActor.participantId,
        actorKind: 'participant' as const,
        externalId: observedActor.externalId,
        normalizedLabel: observedActor.normalizedLabel,
        observedName: observedActor.observedName,
        provider: input.context.provider,
        senderLabel: input.message.senderLabel,
    };
}

export async function attachSessionActivityActors(input: {
    messages: SessionActivitySnapshot['messages'];
    sessions: LiveSession[];
}) {
    if (input.messages.length === 0) {
        return;
    }

    const agentLookup = await loadAgentLookup();
    const sessionContextByKey = new Map(
        input.sessions.map((session) => [session.key, getSessionActorContext(session)])
    );
    const participantCandidates: ParticipantCandidate[] = [];
    const canonicalParticipantIdsByProviderAndLabel = new Map<string, string>();
    const messageById = new Map(input.messages.map((message) => [message.id, message]));

    for (const message of input.messages) {
        message.actorId = null;
        message.actorKind = null;

        const resolvedActor = resolveMessageActor({
            agentLookup,
            context: sessionContextByKey.get(message.sessionKey) ?? null,
            message,
        });

        if (!resolvedActor) {
            continue;
        }

        if (resolvedActor.actorKind === 'agent') {
            message.actorId = resolvedActor.actorId;
            message.actorKind = resolvedActor.actorKind;
            continue;
        }

        participantCandidates.push({
            accountKey: resolvedActor.accountKey,
            externalId: resolvedActor.externalId,
            messageId: message.id,
            normalizedLabel: resolvedActor.normalizedLabel,
            observedName: resolvedActor.observedName,
            participantId: resolvedActor.actorId,
            provider: resolvedActor.provider,
            senderLabel: resolvedActor.senderLabel,
            timestamp: message.timestamp ?? message.syncedAt,
        });

        if (resolvedActor.externalId) {
            canonicalParticipantIdsByProviderAndLabel.set(
                `${resolvedActor.provider}:${resolvedActor.normalizedLabel}`,
                resolvedActor.actorId
            );
        }
    }

    if (participantCandidates.length === 0) {
        return;
    }

    const storedParticipantIds = await resolveParticipantIdsForObservedSenders(
        participantCandidates.map((candidate) => ({
            key: candidate.messageId,
            provider: candidate.provider,
            senderLabel: candidate.senderLabel,
        }))
    );
    const participantRecords = new Map<
        string,
        {
            createdAt: string;
            id: string;
            accountKey: string | null;
            externalId: string | null;
            lastSeenAt: string;
            observedName: string;
            provider: string;
            updatedAt: string;
        }
    >();
    const participantLabelRecords = new Map<
        string,
        {
            createdAt: string;
            id: string;
            label: string;
            lastSeenAt: string;
            normalizedLabel: string;
            participantId: string;
            updatedAt: string;
        }
    >();

    for (const candidate of participantCandidates) {
        const storedParticipantId = storedParticipantIds.get(candidate.messageId) ?? null;
        const canonicalParticipantId = candidate.externalId
            ? (canonicalParticipantIdsByProviderAndLabel.get(
                  `${candidate.provider}:${candidate.normalizedLabel}`
              ) ?? null)
            : null;
        const participantId =
            storedParticipantId ?? canonicalParticipantId ?? candidate.participantId;

        participantRecords.set(participantId, {
            accountKey: candidate.accountKey,
            createdAt: candidate.timestamp,
            externalId: candidate.externalId,
            id: participantId,
            lastSeenAt: candidate.timestamp,
            observedName: candidate.observedName,
            provider: candidate.provider,
            updatedAt: candidate.timestamp,
        });
        participantLabelRecords.set(`${participantId}:${candidate.normalizedLabel}`, {
            createdAt: candidate.timestamp,
            id: `${participantId}:label:${encodeURIComponent(candidate.normalizedLabel)}`,
            label: candidate.senderLabel,
            lastSeenAt: candidate.timestamp,
            normalizedLabel: candidate.normalizedLabel,
            participantId,
            updatedAt: candidate.timestamp,
        });

        const message = messageById.get(candidate.messageId);
        if (message) {
            message.actorId = participantId;
            message.actorKind = 'participant';
        }
    }

    await Promise.all([
        upsertParticipants([...participantRecords.values()]),
        upsertParticipantLabels([...participantLabelRecords.values()]),
    ]);
}
