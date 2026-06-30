import type {
    AgentRuntimeChat,
    AgentRuntimeChatParticipant,
    TavernApiSchema,
    TavernChat,
} from '@tavern/api';
import { TavernApiError } from '@tavern/sdk';
import {
    createAgentRuntimeClientForConnection,
    createTavernClientForConnection,
} from '../agent-runtime/client-factory.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export interface RuntimeChatRecord {
    chat: AgentRuntimeChat;
    createdAt: string | null;
    runtimeId: string;
    updatedAt: string | null;
}

interface TavernChatMetadata {
    agentIds: string[];
    archived: boolean;
    displayName: string;
    displayNameSource: TavernChatDisplayNameSource;
    groupSystemPrompt: string | null;
    tabAppearance: TavernChatTabAppearance;
}

export type TavernChatDisplayNameSource = 'explicit' | 'generated';

export interface TavernChatTabAppearance {
    color: string | null;
}

const localHumanParticipantId = 'usr_tavern';

export async function listRuntimeChatRecords(options?: {
    chatId?: string;
    includeExternal?: boolean;
    includeArchived?: boolean;
}): Promise<RuntimeChatRecord[]> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return [];
    }

    const tavernClient = createTavernClientForConnection(connection);

    if (options?.chatId) {
        const chat = await getTavernChatOrNull(tavernClient, options.chatId);

        if (!chat) {
            return [];
        }

        const record: RuntimeChatRecord = {
            chat: tavernChatToRuntimeChat(chat),
            createdAt: chat.created_at,
            runtimeId: connection.id,
            updatedAt: chat.updated_at,
        };

        if (!options.includeArchived && isArchivedTavernChat(record.chat)) {
            return [];
        }

        return [record];
    }

    const includeExternal = options?.includeExternal !== false;
    const runtimeClient = includeExternal
        ? createAgentRuntimeClientForConnection(connection)
        : null;
    const [tavernChats, runtimeChats] = await Promise.all([
        listAllTavernChats(tavernClient),
        runtimeClient ? runtimeClient.listChats().then((result) => result.chats) : [],
    ]);
    const tavernRecords = tavernChats
        .map((chat) => ({
            chat: tavernChatToRuntimeChat(chat),
            createdAt: chat.created_at,
            runtimeId: connection.id,
            updatedAt: chat.updated_at,
        }))
        .filter((record) => options?.includeArchived || !isArchivedTavernChat(record.chat));
    const externalRecords = includeExternal
        ? runtimeChats
              .filter((chat) => chat.platform !== 'tavern')
              .map((chat) => ({
                  chat,
                  createdAt: null,
                  runtimeId: connection.id,
                  updatedAt: null,
              }))
        : [];

    return [...tavernRecords, ...externalRecords];
}

export async function getRuntimeChatRecord(chatId: string) {
    return (
        (await listRuntimeChatRecords({ includeArchived: true })).find(
            (record) => record.chat.id === chatId
        ) ?? null
    );
}

export async function createRuntimeTavernChat(input: {
    agentIds: string[];
    displayName: string;
    displayNameSource: TavernChatDisplayNameSource;
    id: string;
}) {
    const { client } = await requireRuntimeChatClient();
    await client.chat.create({
        id: input.id,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            displayNameSource: input.displayNameSource,
            groupSystemPrompt: null,
            id: input.id,
            tabAppearance: emptyTabAppearance(),
        }),
        participants: buildRuntimeTavernParticipants(input.agentIds),
        title: input.displayName,
    });
}

export async function updateRuntimeTavernChat(input: {
    agentIds: string[];
    displayName: string;
    id: string;
}) {
    const { client } = await requireRuntimeChatClient();
    const current = await getTavernChatOrNull(client, input.id);
    const archived = current ? readTavernChatMetadata(current).archived : false;
    const metadata = current ? readTavernChatMetadata(current) : null;

    await client.chat.create({
        id: input.id,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: input.agentIds,
            archived,
            displayName: input.displayName,
            displayNameSource: 'explicit',
            groupSystemPrompt: metadata?.groupSystemPrompt ?? null,
            id: input.id,
            tabAppearance: metadata?.tabAppearance ?? emptyTabAppearance(),
        }),
        participants: buildRuntimeTavernParticipants(input.agentIds),
        title: input.displayName,
    });
}

export async function archiveRuntimeTavernChat(chatId: string) {
    const { client } = await requireRuntimeChatClient();
    const current = await getTavernChatOrNull(client, chatId);

    if (!current) {
        throw new Error(`No Tavern chat named "${chatId}" exists.`);
    }

    const metadata = readTavernChatMetadata(current);
    await client.chat.create({
        id: chatId,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: metadata.agentIds,
            archived: true,
            displayName: metadata.displayName,
            displayNameSource: metadata.displayNameSource,
            groupSystemPrompt: metadata.groupSystemPrompt,
            id: chatId,
            tabAppearance: metadata.tabAppearance,
        }),
        title: metadata.displayName,
    });
}

export async function updateRuntimeTavernChatTabAppearance(input: {
    chatId: string;
    tabAppearance: TavernChatTabAppearance;
}) {
    const { client } = await requireRuntimeChatClient();
    const current = await getTavernChatOrNull(client, input.chatId);

    if (!current) {
        throw new Error(`No Tavern chat named "${input.chatId}" exists.`);
    }

    const metadata = readTavernChatMetadata(current);
    await client.chat.create({
        id: input.chatId,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: metadata.agentIds,
            archived: metadata.archived,
            displayName: metadata.displayName,
            displayNameSource: metadata.displayNameSource,
            groupSystemPrompt: metadata.groupSystemPrompt,
            id: input.chatId,
            tabAppearance: input.tabAppearance,
        }),
        title: current.title,
    });
}

export async function updateRuntimeTavernChatSystemPrompt(input: {
    chatId: string;
    systemPrompt: string | null;
}) {
    const { client } = await requireRuntimeChatClient();
    const current = await getTavernChatOrNull(client, input.chatId);

    if (!current) {
        throw new Error(`No Tavern chat named "${input.chatId}" exists.`);
    }

    const metadata = readTavernChatMetadata(current);
    await client.chat.create({
        id: input.chatId,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: metadata.agentIds,
            archived: metadata.archived,
            displayName: metadata.displayName,
            displayNameSource: metadata.displayNameSource,
            groupSystemPrompt: input.systemPrompt,
            id: input.chatId,
            tabAppearance: metadata.tabAppearance,
        }),
        title: current.title,
    });
}

export function presentRuntimeChatLabel(chat: AgentRuntimeChat) {
    const platformMetadata = chat.platformMetadata;

    if (platformMetadata?.provider === 'discord') {
        if (chat.scope === 'channel') {
            const name = platformMetadata.channel?.name;

            if (name) {
                return name.startsWith('#') ? name : `#${name}`;
            }

            return platformMetadata.channel?.id
                ? `Discord channel ${platformMetadata.channel.id}`
                : 'Discord channel';
        }

        if (chat.scope === 'dm') {
            return (
                platformMetadata.observedLabels[0] ?? platformMetadata.dm?.userId ?? 'Discord DM'
            );
        }

        return platformMetadata.observedLabels[0] ?? chat.target ?? chat.id;
    }

    return readRuntimeChatDisplayName(chat) ?? chat.target ?? chat.id;
}

export function readRuntimeChatDisplayName(chat: AgentRuntimeChat) {
    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : null;
    const displayName = tavern?.displayName;

    return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null;
}

async function requireRuntimeChatClient() {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Tavern Runtime is not configured.');
    }

    return {
        client: createTavernClientForConnection(connection),
        runtimeId: connection.id,
    };
}

async function listAllTavernChats(client: ReturnType<typeof createTavernClientForConnection>) {
    const chats: TavernChat[] = [];
    let cursor: string | null = null;

    do {
        const page = await client.chat.list({ cursor, limit: 500 });
        chats.push(...page.chats);
        cursor = page.next_cursor;
    } while (cursor);

    return chats;
}

async function getTavernChatOrNull(
    client: ReturnType<typeof createTavernClientForConnection>,
    chatId: string
) {
    try {
        return await client.chat.get(chatId);
    } catch (error) {
        if (error instanceof TavernApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

function tavernChatToRuntimeChat(chat: TavernChat): AgentRuntimeChat {
    const metadata = readTavernChatMetadata(chat);
    const agentIds = resolveTavernChatAgentIds(chat, metadata);
    const target = `${chat.kind}:${chat.id}`;

    return {
        bindingId: null,
        bindings: agentIds.map((agentId) => ({ agentId })),
        id: chat.id,
        inboundMode: 'active',
        metadata: {
            ...chat.metadata,
            tavern: {
                ...metadata,
                archived: metadata.archived,
                displayNameSource: metadata.displayNameSource,
                groupSystemPrompt: metadata.groupSystemPrompt,
                tabAppearance: metadata.tabAppearance,
            },
        },
        parentTarget: null,
        participants: chat.participants.flatMap(toRuntimeChatParticipants),
        platform: 'tavern',
        platformMetadata: {
            chatId: chat.id,
            conversationId: null,
            observedLabels: [metadata.displayName],
            provider: 'tavern',
            sourceRecords: [],
        },
        requiresTrigger: false,
        scope: chat.kind === 'dm' ? 'dm' : 'channel',
        target,
        trigger: null,
    };
}

function toRuntimeChatParticipants(
    participant: TavernChat['participants'][number]
): AgentRuntimeChatParticipant[] {
    if (participant.kind === 'agent') {
        return [{ agentId: participant.id, type: 'agent' }];
    }

    if (participant.kind === 'system' || participant.kind === 'plugin') {
        return [];
    }

    return [
        {
            accountKey: null,
            externalId: null,
            name: participant.label ?? participant.id,
            observedLabels: participant.label ? [participant.label] : [participant.id],
            participantId: participant.id,
            platform: 'tavern',
            type: 'participant',
        },
    ];
}

function resolveTavernChatAgentIds(chat: TavernChat, metadata: TavernChatMetadata) {
    const participantAgentIds = chat.participants
        .filter((participant) => participant.kind === 'agent')
        .map((participant) => participant.id);

    return [...new Set([...participantAgentIds, ...metadata.agentIds])];
}

function readTavernChatMetadata(chat: TavernChat): TavernChatMetadata {
    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : {};
    const agentIds = Array.isArray(tavern.agentIds)
        ? tavern.agentIds.filter((agentId): agentId is string => typeof agentId === 'string')
        : [];
    const displayName = typeof tavern.displayName === 'string' ? tavern.displayName : chat.id;
    const displayNameSource = tavern.displayNameSource === 'explicit' ? 'explicit' : 'generated';
    const groupSystemPrompt =
        typeof tavern.groupSystemPrompt === 'string' && tavern.groupSystemPrompt.trim()
            ? tavern.groupSystemPrompt.trim()
            : null;

    return {
        agentIds,
        archived: tavern.archived === true,
        displayName,
        displayNameSource,
        groupSystemPrompt,
        tabAppearance: readTavernChatTabAppearance(tavern.tabAppearance),
    };
}

function buildRuntimeTavernChatMetadata(input: {
    agentIds: string[];
    archived: boolean;
    displayName: string;
    displayNameSource: TavernChatDisplayNameSource;
    groupSystemPrompt: string | null;
    id: string;
    tabAppearance: TavernChatTabAppearance;
}) {
    return {
        runtime: {
            source: 'tavern',
        },
        tavern: {
            agentIds: input.agentIds,
            archived: input.archived,
            displayName: input.displayName,
            displayNameSource: input.displayNameSource,
            ...(input.groupSystemPrompt ? { groupSystemPrompt: input.groupSystemPrompt } : {}),
            tabAppearance: input.tabAppearance,
        },
    };
}

function readTavernChatTabAppearance(input: unknown): TavernChatTabAppearance {
    if (!(input && typeof input === 'object')) {
        return emptyTabAppearance();
    }

    const record = input as Record<string, unknown>;
    const color =
        typeof record.color === 'string' && /^#[0-9a-fA-F]{6}$/u.test(record.color)
            ? record.color
            : null;
    return { color };
}

function buildRuntimeTavernParticipants(agentIds: string[]): TavernApiSchema<'Participant'>[] {
    return [
        {
            id: localHumanParticipantId,
            kind: 'user',
            label: 'You',
            metadata: { source: 'tavern' },
        },
        ...agentIds.map((agentId) => ({
            id: agentId,
            kind: 'agent' as const,
            label: null,
            metadata: { agentId, source: 'tavern' },
        })),
    ];
}

function emptyTabAppearance(): TavernChatTabAppearance {
    return { color: null };
}

function isArchivedTavernChat(chat: AgentRuntimeChat) {
    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : null;

    return tavern?.archived === true;
}
