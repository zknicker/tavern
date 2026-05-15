import type {
    AgentRuntimeChatParticipant,
    AgentRuntimeChatPlatformMetadata,
} from '@tavern/agent-runtime-protocol';
import { listAgents } from '../agents/catalog.ts';
import { buildAgentPalette, resolveAgentAvatar, resolveAgentName } from '../agents/palette.ts';
import {
    resolveParticipantAvatar,
    resolveParticipantColor,
    resolveParticipantName,
} from '../participants/presentation.ts';
import { listChatProjections, parseChatRawJson } from '../storage/chats.ts';
import {
    listParticipants,
    type Participant,
    resolveParticipantIdsForSourceIdentities,
} from '../storage/participants.ts';
import { listSessionProjections, parseSessionProjection } from '../storage/sessions.ts';
import { chatListSchema } from './contracts.ts';
import { resolveChatScope, resolveObservedConversationKind } from './conversation-kind.ts';
import { findChatSessionKeyForAgent } from './session-keys.ts';
import { buildChatId, compareChatActors, resolveChatIdentityFromId } from './shared.ts';
import {
    type ChatSource,
    isRuntimeSessionSource,
    presentRuntimeSessionDisplayName,
    resolveChatSource,
} from './source.ts';

type ChatProjectionRecord = Awaited<ReturnType<typeof listChatProjections>>[number];
type ParsedRuntimeChat = ReturnType<typeof parseChatRawJson>;
interface RuntimeChatEntry {
    record: ChatProjectionRecord;
    runtimeChat: ParsedRuntimeChat;
}

function compareOptionalTimestamp(left: string | null, right: string | null) {
    if (!(left || right)) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    return right.localeCompare(left);
}

function presentProjectedChatDisplayName(input: {
    identity: NonNullable<ReturnType<typeof resolveChatIdentityFromId>>;
    runtimeChat: ParsedRuntimeChat | null;
    source: ChatSource;
    targetParticipant: ReturnType<typeof toChatTargetParticipant>;
}) {
    if (isRuntimeSessionSource(input.source)) {
        return presentRuntimeSessionDisplayName(input.source);
    }

    const platformMetadata = input.runtimeChat?.platformMetadata ?? null;

    if (platformMetadata?.provider === 'discord') {
        return presentDiscordChatDisplayName({
            metadata: platformMetadata,
            scope: input.runtimeChat?.scope ?? null,
            target: input.runtimeChat?.target ?? input.identity.target,
            targetParticipant: input.targetParticipant,
        });
    }

    if (input.identity.type === 'tavern') {
        return readTavernDisplayName(input.runtimeChat?.metadata) ?? input.identity.id;
    }

    if (input.targetParticipant) {
        return input.targetParticipant.name;
    }

    return presentGenericTarget(input.identity.type, input.identity.target);
}

function presentProjectedChatTitle(input: {
    conversationKind: 'channel' | 'direct' | 'group' | 'topic';
    displayName: string;
    participants: Array<{
        actorId: string;
        actorType: 'agent' | 'participant';
        name: string;
        profileId?: string | null;
    }>;
    platform: string;
    source: ChatSource;
}) {
    if (isRuntimeSessionSource(input.source)) {
        return input.displayName;
    }

    if (input.conversationKind !== 'direct') {
        return input.displayName;
    }

    if (input.platform === 'discord') {
        const agentTitle = formatChatActorNames(
            input.participants.filter((participant) => participant.actorType === 'agent')
        );
        const participantTitle = formatChatActorNames(
            input.participants.filter((participant) => participant.actorType === 'participant')
        );
        const discordTitle =
            agentTitle && participantTitle
                ? `${agentTitle} <-> ${participantTitle}`
                : (agentTitle ?? participantTitle);

        return discordTitle ? `Discord DM ${discordTitle}` : `Discord DM ${input.displayName}`;
    }

    const participantTitle = formatChatActorNames([...input.participants].sort(compareChatActors));

    return participantTitle ?? input.displayName;
}

function presentDiscordChatDisplayName(input: {
    metadata: Extract<AgentRuntimeChatPlatformMetadata, { provider: 'discord' }>;
    scope: 'channel' | 'dm' | 'group' | 'topic' | null;
    target: string | null;
    targetParticipant: ReturnType<typeof toChatTargetParticipant>;
}) {
    if (input.scope === 'dm') {
        return (
            input.targetParticipant?.name ??
            input.metadata.dm?.userId ??
            presentGenericTarget('discord', input.target)
        );
    }

    if (input.scope === 'channel') {
        return presentDiscordChannelName(input.metadata.channel?.name, input.metadata.channel?.id);
    }

    if (input.scope === 'topic') {
        return (
            input.metadata.thread?.name ??
            `Discord topic ${input.metadata.thread?.id ?? input.target ?? ''}`.trim()
        );
    }

    if (input.scope === 'group') {
        return input.metadata.observedLabels[0] ?? presentGenericTarget('discord', input.target);
    }

    return input.metadata.observedLabels[0] ?? presentGenericTarget('discord', input.target);
}

function presentDiscordChannelName(name: string | null | undefined, id: string | null | undefined) {
    if (name) {
        return name.startsWith('#') ? name : `#${name}`;
    }

    return id ? `Discord channel ${id}` : 'Discord channel';
}

function presentGenericTarget(platform: string, target: string | null) {
    return target ? `${platform}:${target}` : platform;
}

function readTavernDisplayName(metadata: Record<string, unknown> | undefined) {
    const tavern =
        typeof metadata?.tavern === 'object' && metadata.tavern !== null
            ? (metadata.tavern as Record<string, unknown>)
            : null;
    const displayName = tavern?.displayName;

    return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null;
}

function formatChatActorNames(actors: Array<{ name: string }>) {
    if (actors.length === 0) {
        return null;
    }

    if (actors.length === 1) {
        return actors[0]?.name ?? null;
    }

    if (actors.length === 2) {
        return `${actors[0]?.name} and ${actors[1]?.name}`;
    }

    return actors.map((actor) => actor.name).join(', ');
}

export async function listChats() {
    const [agents, participants, sessionRecords, chatRecords] = await Promise.all([
        listAgents(),
        listParticipants(),
        listSessionProjections(),
        listChatProjections({ includeArchived: true }),
    ]);
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const participantById = new Map(
        participants.map((participant) => [participant.id, participant])
    );
    const archivedChatIds = new Set(
        chatRecords.filter((record) => record.isArchived).map((record) => record.id)
    );
    const agentRuntimeChats = chatRecords
        .filter((record) => !record.isArchived)
        .map((record) => ({
            record,
            runtimeChat: parseChatRawJson(record),
        }));
    const agentRuntimeChatsById = new Map(agentRuntimeChats.map((chat) => [chat.record.id, chat]));
    const participantIdsByRuntimeParticipantKey =
        await buildRuntimeParticipantIdMap(agentRuntimeChats);
    const sessions = sessionRecords.flatMap((record) => {
        const session = parseSessionProjection(record);
        return session ? [session] : [];
    });
    const sessionsByChatId = new Map<string, typeof sessions>();

    for (const session of sessions) {
        const bucket = sessionsByChatId.get(session.chatId) ?? [];
        bucket.push(session);
        sessionsByChatId.set(session.chatId, bucket);
    }

    const runtimeSessionChatIds = [...sessionsByChatId.entries()].flatMap(([chatId, sessions]) =>
        sessions.some((session) => session.platform !== 'tavern') ? [chatId] : []
    );
    const chatIds = new Set(
        [...agentRuntimeChatsById.keys(), ...runtimeSessionChatIds].filter(
            (chatId) => !archivedChatIds.has(chatId)
        )
    );

    return chatListSchema.parse({
        chats: [...chatIds]
            .map((chatId) => {
                const agentRuntimeChatEntry = agentRuntimeChatsById.get(chatId) ?? null;
                const agentRuntimeChat = agentRuntimeChatEntry?.runtimeChat ?? null;
                const chatSessions = sessionsByChatId.get(chatId) ?? [];
                const identity = resolveProjectedChatIdentity({
                    chatId,
                    runtimeChat: agentRuntimeChat,
                });

                if (!identity) {
                    return null;
                }

                const boundAgentIds = [
                    ...new Set([
                        ...(agentRuntimeChatEntry
                            ? resolveAgentParticipants({
                                  participants: agentRuntimeChat?.participants ?? [],
                              })
                            : []),
                        ...(agentRuntimeChatEntry
                            ? (agentRuntimeChat?.bindings ?? []).map((binding) => binding.agentId)
                            : []),
                        ...chatSessions.map((session) => session.agentId),
                    ]),
                ].sort((left, right) => left.localeCompare(right));
                const uniqueParticipants = [
                    ...boundAgentIds
                        .map((agentId) => {
                            const agent = agentById.get(agentId);

                            if (!agent) {
                                return null;
                            }

                            return {
                                actorId: agent.id,
                                actorType: 'agent' as const,
                                avatar: resolveAgentAvatar(agent),
                                name: resolveAgentName(agent),
                                primaryColor: buildAgentPalette(agent).accentFrom,
                            };
                        })
                        .flatMap((participant) => (participant ? [participant] : [])),
                    ...resolveObservedParticipants({
                        idsByRuntimeParticipantKey: participantIdsByRuntimeParticipantKey,
                        participantById,
                        participants: agentRuntimeChat?.participants ?? [],
                        chatId: agentRuntimeChatEntry?.record.id ?? null,
                    }),
                ].sort(compareChatActors);
                const runtimeLastActivityAt = [...chatSessions].reduce<string | null>(
                    (latest, session) =>
                        compareOptionalTimestamp(
                            latest,
                            session.lastActivityAt ?? session.startedAt
                        ) > 0
                            ? (session.lastActivityAt ?? session.startedAt)
                            : latest,
                    null
                );
                const lastActivityAt =
                    runtimeLastActivityAt ??
                    (identity.type === 'tavern'
                        ? (agentRuntimeChatEntry?.record.updatedAt ?? null)
                        : null);
                const latestSession =
                    [...chatSessions]
                        .sort((left, right) =>
                            compareOptionalTimestamp(
                                left.lastActivityAt ?? left.startedAt,
                                right.lastActivityAt ?? right.startedAt
                            )
                        )
                        .map((session) => ({
                            agentId: session.agentId,
                            lastActivityAt: session.lastActivityAt ?? session.startedAt,
                            platform: session.platform,
                            sessionId: session.sessionId ?? null,
                            sessionKey: session.key,
                            title: session.title,
                        }))[0] ?? null;
                const targetParticipant = toChatTargetParticipant(
                    getPrimaryObservedParticipant({
                        idsByRuntimeParticipantKey: participantIdsByRuntimeParticipantKey,
                        participantById,
                        participants: agentRuntimeChat?.participants ?? [],
                        chatId: agentRuntimeChatEntry?.record.id ?? null,
                    })
                );
                const source = resolveChatSource({
                    identity,
                    latestSessionKey: latestSession?.sessionKey ?? null,
                    latestSessionPlatform: latestSession?.platform ?? null,
                    chatId: agentRuntimeChatEntry?.record.id ?? null,
                    runtimePlatform: agentRuntimeChat?.platform ?? null,
                });
                const displayName = presentProjectedChatDisplayName({
                    identity,
                    runtimeChat: agentRuntimeChat,
                    source,
                    targetParticipant,
                });
                const conversationKind =
                    identity.type === 'tavern' && !identity.target
                        ? 'group'
                        : resolveObservedConversationKind({
                              configured: agentRuntimeChat !== null,
                              participants: uniqueParticipants,
                              target: identity.target,
                              type: identity.type,
                          });
                const title = presentProjectedChatTitle({
                    conversationKind,
                    displayName,
                    participants: uniqueParticipants,
                    platform: identity.type,
                    source,
                });
                const canSend =
                    agentRuntimeChat !== null &&
                    boundAgentIds.some((agentId) => {
                        const agent = agentById.get(agentId);

                        return agent
                            ? Boolean(findChatSessionKeyForAgent(agentRuntimeChat, agent.id))
                            : false;
                    });

                return {
                    boundAgentIds,
                    canSend,
                    conversationKind,
                    displayName,
                    externalId: identity.externalId,
                    framework: identity.type === 'tavern' ? 'tavern' : 'agentRuntime',
                    id: chatId,
                    isEnabled: canSend,
                    lastActivityAt,
                    latestSession,
                    participants: uniqueParticipants,
                    agentRuntimeSync: null,
                    platformMetadata: agentRuntimeChat?.platformMetadata ?? null,
                    scope: resolveChatScope(identity.target),
                    sessionCount: chatSessions.length,
                    source,
                    target: identity.target,
                    targetParticipant,
                    title,
                    type: identity.type,
                };
            })
            .flatMap((chat) => (chat ? [chat] : []))
            .sort(
                (left, right) =>
                    compareOptionalTimestamp(left.lastActivityAt, right.lastActivityAt) ||
                    left.title.localeCompare(right.title)
            ),
    });
}

async function buildRuntimeParticipantIdMap(entries: RuntimeChatEntry[]) {
    const sourceIdentities = entries.flatMap((entry) =>
        entry.runtimeChat.participants.flatMap((participant) => {
            if (participant.type !== 'participant' || !participant.externalId) {
                return [];
            }

            return [
                {
                    externalId: participant.externalId,
                    key: getRuntimeParticipantKey({
                        participantId: participant.participantId,
                        chatId: entry.record.id,
                    }),
                    provider: participant.platform,
                },
            ];
        })
    );

    return await resolveParticipantIdsForSourceIdentities(sourceIdentities);
}

function toChatTargetParticipant(participant: Participant | null) {
    if (!participant) {
        return null;
    }

    return {
        avatar: resolveParticipantAvatar(participant),
        id: participant.id,
        name: resolveParticipantName(participant),
        observedName: participant.observedName,
        primaryColor: resolveParticipantColor(participant),
        profileId: participant.linkedProfile?.id ?? null,
    };
}

function resolveProjectedChatIdentity(input: {
    chatId: string;
    runtimeChat: ReturnType<typeof parseChatRawJson> | null;
}) {
    if (input.runtimeChat?.platform && input.runtimeChat.target) {
        const id = buildChatId({
            externalId: null,
            target: input.runtimeChat.target,
            type: input.runtimeChat.platform,
        });

        if (id) {
            return resolveChatIdentityFromId(id);
        }
    }

    return resolveChatIdentityFromId(input.chatId);
}

function resolveAgentParticipants(input: { participants: AgentRuntimeChatParticipant[] }) {
    return input.participants
        .filter((participant) => participant.type === 'agent')
        .map((participant) => participant.agentId);
}

function resolveObservedParticipants(input: {
    idsByRuntimeParticipantKey: Map<string, string>;
    participantById: Map<string, Participant>;
    participants: AgentRuntimeChatParticipant[];
    chatId: string | null;
}) {
    return input.participants
        .filter((participant) => participant.type === 'participant')
        .map((participant) => {
            const resolvedParticipantId = resolveRuntimeParticipantId({
                idsByRuntimeParticipantKey: input.idsByRuntimeParticipantKey,
                participant,
                chatId: input.chatId,
            });

            return input.participantById.get(resolvedParticipantId) ?? null;
        })
        .flatMap((participant) => {
            if (!participant) {
                return [];
            }

            return [
                {
                    actorId: participant.id,
                    actorType: 'participant' as const,
                    avatar: resolveParticipantAvatar(participant),
                    name: resolveParticipantName(participant),
                    primaryColor: resolveParticipantColor(participant),
                    profileId: participant.linkedProfile?.id ?? null,
                },
            ];
        });
}

function getPrimaryObservedParticipant(input: {
    idsByRuntimeParticipantKey: Map<string, string>;
    participantById: Map<string, Participant>;
    participants: AgentRuntimeChatParticipant[];
    chatId: string | null;
}) {
    const participant = input.participants.find((entry) => entry.type === 'participant');

    if (!participant) {
        return null;
    }

    return (
        input.participantById.get(
            resolveRuntimeParticipantId({
                idsByRuntimeParticipantKey: input.idsByRuntimeParticipantKey,
                participant,
                chatId: input.chatId,
            })
        ) ?? null
    );
}

function resolveRuntimeParticipantId(input: {
    idsByRuntimeParticipantKey: Map<string, string>;
    participant: Extract<AgentRuntimeChatParticipant, { type: 'participant' }>;
    chatId: string | null;
}) {
    const runtimeParticipantKey = input.chatId
        ? getRuntimeParticipantKey({
              participantId: input.participant.participantId,
              chatId: input.chatId,
          })
        : null;

    return (
        (runtimeParticipantKey
            ? input.idsByRuntimeParticipantKey.get(runtimeParticipantKey)
            : null) ?? input.participant.participantId
    );
}

function getRuntimeParticipantKey(input: { chatId: string; participantId: string }) {
    return `${input.chatId}:${input.participantId}`;
}
