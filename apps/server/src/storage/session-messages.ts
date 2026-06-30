import type { AgentRuntimeSessionMessage } from '@tavern/api';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';
import { normalizeAgentModelIdentity } from '../model/model-mapping.ts';
import {
    type RuntimeParticipantSource,
    resolveRuntimeParticipantSourceIdentities,
    syncRuntimeParticipantIdentities,
} from '../participants/chat-participants.ts';
import { resolveParticipantIdsForSourceIdentities } from './participants.ts';

export type SessionMessageRecord = typeof sessionMessagesTable.$inferSelect;

export async function getSessionMessageState(sessionKey: string) {
    const [latest] = await db
        .select({ syncedAt: sessionMessagesTable.syncedAt })
        .from(sessionMessagesTable)
        .where(eq(sessionMessagesTable.sessionKey, sessionKey))
        .orderBy(desc(sessionMessagesTable.syncedAt))
        .limit(1);

    return {
        hasMessages: Boolean(latest),
        lastSyncedAt: latest?.syncedAt ?? null,
    };
}

export async function syncSessionMessagesForRuntime(input: {
    messagesBySessionKey: Map<string, AgentRuntimeSessionMessage[]>;
    runtimeId: string;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const participantActorIdsByMessageKey = await syncMessageParticipants({
        messagesBySessionKey: input.messagesBySessionKey,
        syncedAt: timestamp,
    });
    let synced = 0;

    for (const [runtimeSessionKey, messages] of input.messagesBySessionKey.entries()) {
        const sessionKey = runtimeSessionKey;

        for (const [index, message] of messages.entries()) {
            const modelInfo = normalizeAgentModelIdentity({
                model: message.metadata?.agentModel ?? message.metadata?.model ?? null,
                provider: message.metadata?.agentProvider ?? message.metadata?.provider ?? null,
            });
            const id = buildSessionMessageId({
                messageId: message.id,
            });
            const actor = resolveMessageActor({
                actorIdsByMessageKey: participantActorIdsByMessageKey,
                message,
                messageKey: buildMessageParticipantKey({
                    message,
                    runtimeSessionKey,
                }),
                runtimeId: input.runtimeId,
            });

            await db
                .insert(sessionMessagesTable)
                .values({
                    actorId: actor?.id ?? null,
                    actorKind: actor?.kind ?? null,
                    api: message.metadata?.api ?? null,
                    canonicalModelId: modelInfo?.modelRef ?? null,
                    contentJson: null,
                    contentText: message.content,
                    errorMessage: null,
                    externalMessageId: message.id,
                    id,
                    model: modelInfo?.modelId ?? message.metadata?.model ?? null,
                    agentApi: message.metadata?.agentApi ?? message.metadata?.api ?? null,
                    agentModel: modelInfo?.agentModel ?? message.metadata?.agentModel ?? null,
                    agentModelNameId: modelInfo?.agentModelNameId ?? null,
                    agentProvider:
                        modelInfo?.agentProvider ?? message.metadata?.agentProvider ?? null,
                    provider: modelInfo?.provider ?? message.metadata?.provider ?? null,
                    rawJson: JSON.stringify(message),
                    role: message.senderType,
                    senderLabel: message.senderName,
                    seq: index,
                    sessionKey,
                    stopReason: message.metadata?.stopReason ?? null,
                    syncedAt: timestamp,
                    timestamp: message.timestamp,
                    usageJson:
                        message.metadata?.usage === undefined
                            ? null
                            : JSON.stringify(message.metadata.usage),
                })
                .onConflictDoUpdate({
                    target: sessionMessagesTable.id,
                    set: {
                        actorId: actor?.id ?? null,
                        actorKind: actor?.kind ?? null,
                        api: message.metadata?.api ?? null,
                        canonicalModelId: modelInfo?.modelRef ?? null,
                        contentText: message.content,
                        model: modelInfo?.modelId ?? message.metadata?.model ?? null,
                        agentApi: message.metadata?.agentApi ?? message.metadata?.api ?? null,
                        agentModel: modelInfo?.agentModel ?? message.metadata?.agentModel ?? null,
                        agentModelNameId: modelInfo?.agentModelNameId ?? null,
                        agentProvider:
                            modelInfo?.agentProvider ?? message.metadata?.agentProvider ?? null,
                        provider: modelInfo?.provider ?? message.metadata?.provider ?? null,
                        rawJson: JSON.stringify(message),
                        role: message.senderType,
                        senderLabel: message.senderName,
                        seq: index,
                        sessionKey,
                        stopReason: message.metadata?.stopReason ?? null,
                        syncedAt: timestamp,
                        timestamp: message.timestamp,
                        usageJson:
                            message.metadata?.usage === undefined
                                ? null
                                : JSON.stringify(message.metadata.usage),
                    },
                });
        }

        synced += messages.length;
    }

    return { deleted: 0, synced };
}

export async function listSessionMessagesForSessionKeys(sessionKeys: string[]) {
    if (sessionKeys.length === 0) {
        return [];
    }

    return await db
        .select()
        .from(sessionMessagesTable)
        .where(inArray(sessionMessagesTable.sessionKey, sessionKeys))
        .orderBy(
            asc(sessionMessagesTable.timestamp),
            asc(sessionMessagesTable.seq),
            asc(sessionMessagesTable.id)
        );
}

function buildSessionMessageId(input: { messageId: string }) {
    return input.messageId;
}

function resolveMessageActor(input: {
    actorIdsByMessageKey: Map<string, string>;
    message: AgentRuntimeSessionMessage;
    messageKey: string;
    runtimeId: string;
}): { id: string; kind: 'agent' | 'participant' } | null {
    if (input.message.senderType === 'user') {
        const participantId = input.actorIdsByMessageKey.get(input.messageKey);

        return participantId ? { id: participantId, kind: 'participant' } : null;
    }

    if (input.message.senderType !== 'agent') {
        return null;
    }

    const agentId = input.message.agentId;

    return agentId
        ? {
              id: agentId,
              kind: 'agent',
          }
        : null;
}

async function syncMessageParticipants(input: {
    messagesBySessionKey: Map<string, AgentRuntimeSessionMessage[]>;
    syncedAt: string;
}) {
    const observedIdentities: RuntimeParticipantSource[] = [];
    const sourceIdentities: Array<{ externalId: string; key: string; provider: string }> = [];

    for (const [runtimeSessionKey, messages] of input.messagesBySessionKey.entries()) {
        for (const message of messages) {
            if (!message.participant) {
                continue;
            }

            const [identity] = resolveRuntimeParticipantSourceIdentities([message.participant]);

            if (!identity) {
                continue;
            }

            observedIdentities.push(identity);
            sourceIdentities.push({
                externalId: identity.externalId ?? '',
                key: buildMessageParticipantKey({ message, runtimeSessionKey }),
                provider: identity.provider,
            });
        }
    }

    const identitiesById = new Map(
        observedIdentities.map((identity) => [identity.participantId, identity])
    );

    await syncRuntimeParticipantIdentities({
        identities: [...identitiesById.values()],
        observedIdentities,
        syncedAt: input.syncedAt,
    });

    return await resolveParticipantIdsForSourceIdentities(sourceIdentities);
}

function buildMessageParticipantKey(input: {
    message: AgentRuntimeSessionMessage;
    runtimeSessionKey: string;
}) {
    return `${input.runtimeSessionKey}:${input.message.id}`;
}
