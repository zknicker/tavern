import type { AgentRuntimeSessionMessage } from '@tavern/agent-runtime-protocol';
import { and, asc, desc, eq, gte, inArray, lte, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';
import { normalizeOpenClawModelIdentity } from '../model/openclaw-mapping.ts';
import {
    type RuntimeParticipantSource,
    resolveRuntimeParticipantSourceIdentities,
    syncRuntimeParticipantIdentities,
} from '../participants/chat-participants.ts';
import { resolveParticipantIdsForSourceIdentities } from './participants.ts';
import { filterDuplicateTavernAcceptedInboundMessages } from './session-message-deduplication.ts';

export type SessionMessageProjection = typeof sessionMessagesTable.$inferSelect;

export async function getSessionMessageProjectionState(sessionKey: string) {
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
    let deleted = 0;
    let synced = 0;

    for (const [runtimeSessionKey, messages] of input.messagesBySessionKey.entries()) {
        const sessionKey = runtimeSessionKey;
        const messagesToSync = await filterDuplicateTavernAcceptedInboundMessages({
            messages,
            sessionKey,
        });
        const window = resolveMessageTimestampWindow(messagesToSync);
        const messageIds = messagesToSync.map((message) =>
            buildSessionMessageId({
                messageId: message.id,
            })
        );

        if (window && messageIds.length > 0) {
            const rowsToDelete = await db
                .select({ id: sessionMessagesTable.id })
                .from(sessionMessagesTable)
                .where(
                    and(
                        eq(sessionMessagesTable.sessionKey, sessionKey),
                        gte(sessionMessagesTable.timestamp, window.start),
                        lte(sessionMessagesTable.timestamp, window.end),
                        notInArray(sessionMessagesTable.id, messageIds)
                    )
                );

            if (rowsToDelete.length > 0) {
                await db.delete(sessionMessagesTable).where(
                    and(
                        eq(sessionMessagesTable.sessionKey, sessionKey),
                        inArray(
                            sessionMessagesTable.id,
                            rowsToDelete.map((row) => row.id)
                        )
                    )
                );
            }

            deleted += rowsToDelete.length;
        }

        for (const [index, message] of messagesToSync.entries()) {
            const modelInfo = normalizeOpenClawModelIdentity({
                harness: message.metadata?.openClawHarness ?? null,
                model: message.metadata?.openClawModel ?? message.metadata?.model ?? null,
                provider: message.metadata?.openClawProvider ?? message.metadata?.provider ?? null,
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
                    canonicalModelId: modelInfo?.modelCatalogId ?? null,
                    contentJson: null,
                    contentText: message.content,
                    errorMessage: null,
                    externalMessageId: message.id,
                    id,
                    model: modelInfo?.modelId ?? message.metadata?.model ?? null,
                    openClawApi: message.metadata?.openClawApi ?? message.metadata?.api ?? null,
                    openClawHarness: modelInfo?.openClawHarness ?? null,
                    openClawModel:
                        modelInfo?.openClawModel ?? message.metadata?.openClawModel ?? null,
                    openClawModelNameId: modelInfo?.openClawModelNameId ?? null,
                    openClawProvider:
                        modelInfo?.openClawProvider ?? message.metadata?.openClawProvider ?? null,
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
                        canonicalModelId: modelInfo?.modelCatalogId ?? null,
                        contentText: message.content,
                        model: modelInfo?.modelId ?? message.metadata?.model ?? null,
                        openClawApi: message.metadata?.openClawApi ?? message.metadata?.api ?? null,
                        openClawHarness: modelInfo?.openClawHarness ?? null,
                        openClawModel:
                            modelInfo?.openClawModel ?? message.metadata?.openClawModel ?? null,
                        openClawModelNameId: modelInfo?.openClawModelNameId ?? null,
                        openClawProvider:
                            modelInfo?.openClawProvider ??
                            message.metadata?.openClawProvider ??
                            null,
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

        synced += messagesToSync.length;
    }

    return { deleted, synced };
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

function resolveMessageTimestampWindow(messages: AgentRuntimeSessionMessage[]) {
    const timestamps = messages
        .map((message) => message.timestamp)
        .filter((timestamp): timestamp is string => Boolean(timestamp))
        .sort();

    if (timestamps.length === 0) {
        return null;
    }

    return {
        end: timestamps.at(-1) ?? timestamps[0],
        start: timestamps[0],
    };
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
