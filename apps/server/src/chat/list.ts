import type { AgentRuntimeChatParticipant, AgentRuntimeChatPlatformMetadata } from '@tavern/api';
import { listAgents } from '../agents/catalog.ts';
import { buildAgentPalette, resolveAgentName } from '../agents/palette.ts';
import { keylessActingUserId } from '../identity/acting-user.ts';
import {
    resolveParticipantAvatar,
    resolveParticipantColor,
    resolveParticipantName,
} from '../participants/presentation.ts';
import { listRuntimeSessions } from '../sessions/runtime-sessions.ts';
import {
    listParticipants,
    type Participant,
    resolveParticipantIdsForSourceIdentities,
} from '../storage/participants.ts';
import { type Chat, chatListSchema, chatSchema } from './contracts.ts';
import {
    resolveChatScope,
    resolveConversationKindFromConfiguredScope,
    resolveObservedConversationKind,
} from './conversation-kind.ts';
import {
    isArchivedTavernChat,
    listRuntimeChatRecords,
    type RuntimeChatRecord,
    readRuntimeChatDisplayName,
} from './runtime-chats.ts';
import { buildChatId, compareChatActors, resolveChatIdentityFromId } from './shared.ts';
import {
    type ChatSource,
    isRuntimeSessionSource,
    presentRuntimeSessionDisplayName,
    resolveChatSource,
} from './source.ts';

type ParsedRuntimeChat = RuntimeChatRecord['chat'];
interface RuntimeChatEntry {
    record: RuntimeChatRecord;
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

function presentChatDisplayName(input: {
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
        return input.runtimeChat
            ? (readRuntimeChatDisplayName(input.runtimeChat) ?? input.identity.id)
            : input.identity.id;
    }

    if (input.targetParticipant) {
        return input.targetParticipant.name;
    }

    return presentGenericTarget(input.identity.type, input.identity.target);
}

function presentChatTitle(input: {
    conversationKind: 'channel' | 'direct' | 'group' | 'task' | 'topic';
    displayName: string;
    participants: Array<{
        actorId: string;
        actorType: 'agent' | 'participant';
        name: string;
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
    scope: 'channel' | 'dm' | 'group' | 'task' | 'topic' | null;
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

export async function listChats(actingUserId: string = keylessActingUserId) {
    return await listChatsWithArchivedFilter('active', actingUserId);
}

export async function listArchivedChats(actingUserId: string = keylessActingUserId) {
    return await listChatsWithArchivedFilter('archived', actingUserId);
}

async function listChatsWithArchivedFilter(
    archivedFilter: 'active' | 'archived',
    actingUserId: string
) {
    const chats = await listChatDetails({
        actingUserId,
        archivedFilter,
        includeExternal: false,
    });
    const itemsById = Object.fromEntries(chats.map((chat) => [chat.id, toChatListItem(chat)]));

    return chatListSchema.parse({
        ids: chats.map((chat) => chat.id),
        itemsById,
    });
}

export async function getChat(
    input: { chatId: string },
    actingUserId: string = keylessActingUserId
) {
    const chats = await listChatDetails({
        actingUserId,
        archivedFilter: 'all',
        chatId: input.chatId,
        includeExternal: false,
    });
    const chat = chats.find((entry) => entry.id === input.chatId) ?? null;

    return chat ? chatSchema.parse(chat) : null;
}

export async function listChatDetails(options?: {
    actingUserId?: string;
    archivedFilter?: 'active' | 'archived' | 'all';
    chatId?: string;
    includeExternal?: boolean;
}) {
    const includeExternal = options?.includeExternal ?? true;
    const archivedFilter = options?.archivedFilter ?? 'active';
    const [agents, participants, sessions, chatRecords] = await Promise.all([
        listAgents(),
        listParticipants(),
        listRuntimeSessions(),
        listRuntimeChatRecords({
            actingUserId: options?.actingUserId,
            chatId: options?.chatId,
            includeArchived: true,
            includeExternal,
            readerId: options?.actingUserId,
        }),
    ]);
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const participantById = new Map(
        participants.map((participant) => [participant.id, participant])
    );
    const archivedChatIds = new Set(
        chatRecords
            .filter((record) => isArchivedTavernChat(record.chat))
            .map((record) => record.chat.id)
    );
    const matchesArchivedFilter = (chatId: string) =>
        archivedFilter === 'all' || (archivedFilter === 'archived') === archivedChatIds.has(chatId);
    const agentRuntimeChats = chatRecords
        .filter((record) => matchesArchivedFilter(record.chat.id))
        .map((record) => ({
            record,
            runtimeChat: record.chat,
        }));
    const agentRuntimeChatsById = new Map(
        agentRuntimeChats.map((chat) => [chat.record.chat.id, chat])
    );
    const participantIdsByRuntimeParticipantKey =
        await buildRuntimeParticipantIdMap(agentRuntimeChats);
    const sessionsByChatId = new Map<string, typeof sessions>();

    for (const session of sessions) {
        const bucket = sessionsByChatId.get(session.chatId) ?? [];
        bucket.push(session);
        sessionsByChatId.set(session.chatId, bucket);
    }

    const runtimeSessionChatIds = includeExternal
        ? [...sessionsByChatId.entries()].flatMap(([chatId, sessions]) =>
              sessions.some((session) => session.platform !== 'tavern') ? [chatId] : []
          )
        : [];
    const chatIds = new Set(
        [...agentRuntimeChatsById.keys(), ...runtimeSessionChatIds].filter(matchesArchivedFilter)
    );

    return [...chatIds]
        .map((chatId) => {
            const agentRuntimeChatEntry = agentRuntimeChatsById.get(chatId) ?? null;
            const agentRuntimeChat = agentRuntimeChatEntry?.runtimeChat ?? null;
            const chatSessions = sessionsByChatId.get(chatId) ?? [];
            const identity = resolveChatIdentity({
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
                    ...(agentRuntimeChatEntry
                        ? []
                        : chatSessions.map((session) => session.agentId)),
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
                            avatar: null,
                            name: resolveAgentName(agent),
                            primaryColor: buildAgentPalette(agent).accentFrom,
                        };
                    })
                    .flatMap((participant) => (participant ? [participant] : [])),
                ...resolveObservedParticipants({
                    idsByRuntimeParticipantKey: participantIdsByRuntimeParticipantKey,
                    participantById,
                    participants: agentRuntimeChat?.participants ?? [],
                    chatId: agentRuntimeChatEntry?.record.chat.id ?? null,
                }),
            ].sort(compareChatActors);
            const runtimeLastActivityAt = [...chatSessions].reduce<string | null>(
                (latest, session) =>
                    compareOptionalTimestamp(latest, session.lastActivityAt ?? session.startedAt) >
                    0
                        ? (session.lastActivityAt ?? session.startedAt)
                        : latest,
                null
            );
            const lastActivityAt =
                runtimeLastActivityAt ??
                (identity.type === 'tavern'
                    ? (agentRuntimeChatEntry?.record.lastActivityAt ?? null)
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
                    chatId: agentRuntimeChatEntry?.record.chat.id ?? null,
                })
            );
            const source = resolveChatSource({
                identity,
                latestSessionKey: latestSession?.sessionKey ?? null,
                latestSessionPlatform: latestSession?.platform ?? null,
                chatId: agentRuntimeChatEntry?.record.chat.id ?? null,
                runtimePlatform: agentRuntimeChat?.platform ?? null,
            });
            const displayName = presentChatDisplayName({
                identity,
                runtimeChat: agentRuntimeChat,
                source,
                targetParticipant,
            });
            const conversationKind =
                resolveConversationKindFromConfiguredScope(agentRuntimeChat?.scope ?? null) ??
                resolveObservedConversationKind({
                    configured: agentRuntimeChat !== null,
                    participants: uniqueParticipants,
                    target: identity.target,
                    type: identity.type,
                });

            if (
                identity.type === 'tavern' &&
                conversationKind === 'direct' &&
                boundAgentIds.length > 0 &&
                !boundAgentIds.some((agentId) => agentById.has(agentId))
            ) {
                return null;
            }

            const title = presentChatTitle({
                conversationKind,
                displayName,
                participants: uniqueParticipants,
                platform: identity.type,
                source,
            });
            const canSend =
                agentRuntimeChat !== null &&
                boundAgentIds.some((agentId) => agentById.has(agentId));

            return {
                activeTurnParticipantIds: agentRuntimeChat?.activeTurnParticipantIds ?? [],
                archived: archivedChatIds.has(chatId),
                boundAgentIds,
                canSend,
                conversationKind,
                createdAt: agentRuntimeChatEntry?.record.createdAt ?? null,
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
                scope:
                    agentRuntimeChat?.scope &&
                    ['channel', 'dm', 'group', 'topic'].includes(agentRuntimeChat.scope)
                        ? agentRuntimeChat.scope
                        : resolveChatScope(identity.target),
                sessionCount: chatSessions.length,
                source,
                systemPrompt: readRuntimeChatSystemPrompt(agentRuntimeChat),
                tabAppearance: readRuntimeChatTabAppearance(agentRuntimeChat),
                target: identity.target,
                targetParticipant,
                title,
                type: identity.type,
                unreadCount: agentRuntimeChat?.unreadCount ?? 0,
            } satisfies Chat;
        })
        .flatMap((chat) => (chat ? [chatSchema.parse(chat)] : []))
        .sort(
            (left, right) =>
                compareOptionalTimestamp(left.lastActivityAt, right.lastActivityAt) ||
                left.title.localeCompare(right.title)
        );
}

function toChatListItem(chat: Chat) {
    return {
        activeTurnParticipantIds: chat.activeTurnParticipantIds,
        agentRuntimeSync: chat.agentRuntimeSync,
        unreadCount: chat.unreadCount,
        archived: chat.archived,
        boundAgentIds: chat.boundAgentIds,
        canSend: chat.canSend,
        conversationKind: chat.conversationKind,
        createdAt: chat.createdAt,
        displayName: chat.displayName,
        framework: chat.framework,
        id: chat.id,
        isEnabled: chat.isEnabled,
        lastActivityAt: chat.lastActivityAt,
        latestSession: chat.latestSession,
        participants: chat.participants,
        scope: chat.scope,
        sessionCount: chat.sessionCount,
        source: chat.source,
        systemPrompt: chat.systemPrompt,
        tabAppearance: chat.tabAppearance,
        targetParticipant: chat.targetParticipant,
        title: chat.title,
        type: chat.type,
    };
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
                        chatId: entry.record.chat.id,
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
    };
}

function resolveChatIdentity(input: { chatId: string; runtimeChat: ParsedRuntimeChat | null }) {
    if (input.runtimeChat?.platform === 'tavern') {
        return {
            externalId: null,
            id: input.chatId,
            target: null,
            type: 'tavern',
        };
    }

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

            return {
                participant,
                stored: input.participantById.get(resolvedParticipantId) ?? null,
            };
        })
        .flatMap(({ participant, stored }) => {
            return [
                {
                    actorId: stored?.id ?? participant.participantId,
                    actorType: 'participant' as const,
                    avatar: stored ? resolveParticipantAvatar(stored) : null,
                    name: stored ? resolveParticipantName(stored) : participant.name,
                    primaryColor: stored ? resolveParticipantColor(stored) : null,
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

    const stored =
        input.participantById.get(
            resolveRuntimeParticipantId({
                idsByRuntimeParticipantKey: input.idsByRuntimeParticipantKey,
                participant,
                chatId: input.chatId,
            })
        ) ?? null;

    return (
        stored ?? {
            accountKey: null,
            externalId: participant.externalId,
            id: participant.participantId,
            labels: participant.observedLabels,
            lastSeenAt: null,
            observedName: participant.name,
            provider: participant.platform,
        }
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

function readRuntimeChatTabAppearance(runtimeChat: ParsedRuntimeChat | null) {
    const tavern =
        typeof runtimeChat?.metadata.tavern === 'object' && runtimeChat.metadata.tavern !== null
            ? (runtimeChat.metadata.tavern as Record<string, unknown>)
            : null;
    const tabAppearance =
        typeof tavern?.tabAppearance === 'object' && tavern.tabAppearance !== null
            ? (tavern.tabAppearance as Record<string, unknown>)
            : null;
    const color =
        typeof tabAppearance?.color === 'string' && /^#[0-9a-fA-F]{6}$/u.test(tabAppearance.color)
            ? tabAppearance.color
            : null;
    return { color };
}

function readRuntimeChatSystemPrompt(runtimeChat: ParsedRuntimeChat | null) {
    const tavern =
        typeof runtimeChat?.metadata.tavern === 'object' && runtimeChat.metadata.tavern !== null
            ? (runtimeChat.metadata.tavern as Record<string, unknown>)
            : null;
    const systemPrompt = tavern?.groupSystemPrompt;

    return typeof systemPrompt === 'string' && systemPrompt.trim() ? systemPrompt.trim() : null;
}
