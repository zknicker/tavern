import type { AgentRuntimeChat, TavernChat } from '@tavern/api';
import { createTavernClient, TavernApiError } from '@tavern/sdk';
import { buildTavernChatSessionKey } from '../agent-runtime/chats.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export interface RuntimeChatRecord {
    chat: AgentRuntimeChat;
    runtimeId: string;
    updatedAt: string | null;
}

interface TavernChatMetadata {
    agentIds: string[];
    archived: boolean;
    displayName: string;
}

export async function listRuntimeChatRecords(options?: {
    includeExternal?: boolean;
    includeArchived?: boolean;
}): Promise<RuntimeChatRecord[]> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return [];
    }

    const includeExternal = options?.includeExternal !== false;
    const tavernClient = createTavernClient({ baseUrl: connection.baseUrl });
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
            runtimeId: connection.id,
            updatedAt: chat.updated_at,
        }))
        .filter((record) => options?.includeArchived || !isArchivedTavernChat(record.chat));
    const externalRecords = includeExternal
        ? runtimeChats
              .filter((chat) => chat.platform !== 'tavern')
              .map((chat) => ({
                  chat,
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
    id: string;
}) {
    const { client } = await requireRuntimeChatClient();
    await client.chat.create({
        id: input.id,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            id: input.id,
        }),
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

    await client.chat.create({
        id: input.id,
        metadata: buildRuntimeTavernChatMetadata({
            agentIds: input.agentIds,
            archived,
            displayName: input.displayName,
            id: input.id,
        }),
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
            id: chatId,
        }),
        title: metadata.displayName,
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

export function runtimeChatSessionKeys(chat: AgentRuntimeChat) {
    return Array.isArray(chat.metadata.sessionKeys)
        ? chat.metadata.sessionKeys.filter(
              (sessionKey): sessionKey is string =>
                  typeof sessionKey === 'string' && sessionKey.trim().length > 0
          )
        : [];
}

async function requireRuntimeChatClient() {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Tavern Runtime is not configured.');
    }

    return {
        client: createTavernClient({ baseUrl: connection.baseUrl }),
        runtimeId: connection.id,
    };
}

async function listAllTavernChats(client: ReturnType<typeof createTavernClient>) {
    const chats: TavernChat[] = [];
    let cursor: string | null = null;

    do {
        const page = await client.chat.list({ cursor, limit: 500 });
        chats.push(...page.chats);
        cursor = page.next_cursor;
    } while (cursor);

    return chats;
}

async function getTavernChatOrNull(client: ReturnType<typeof createTavernClient>, chatId: string) {
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
    const sessionKeys = metadata.agentIds.map((agentId) =>
        buildTavernChatSessionKey(agentId, chat.id)
    );
    const target = `chat:${chat.id}`;

    return {
        bindingId: null,
        bindings: metadata.agentIds.map((agentId) => ({ agentId })),
        id: chat.id,
        inboundMode: 'active',
        metadata: {
            ...chat.metadata,
            sessionKeys,
            tavern: {
                ...metadata,
                archived: metadata.archived,
            },
        },
        parentTarget: null,
        participants: metadata.agentIds.map((agentId) => ({
            agentId,
            type: 'agent',
        })),
        platform: 'tavern',
        platformMetadata: {
            chatId: chat.id,
            conversationId: null,
            observedLabels: [metadata.displayName],
            provider: 'tavern',
            sourceRecords: sessionKeys.map((sessionKey) => ({
                chatId: chat.id,
                clientMessageId: null,
                conversationId: null,
                deliveryId: null,
                runId: null,
                sessionKey,
                source: {
                    channel: 'tavern',
                    target,
                },
            })),
        },
        requiresTrigger: false,
        scope: null,
        target,
        trigger: null,
    };
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

    return {
        agentIds,
        archived: tavern.archived === true,
        displayName,
    };
}

function buildRuntimeTavernChatMetadata(input: {
    agentIds: string[];
    archived: boolean;
    displayName: string;
    id: string;
}) {
    return {
        runtime: {
            source: 'tavern',
        },
        sessionKeys: input.agentIds.map((agentId) => buildTavernChatSessionKey(agentId, input.id)),
        tavern: {
            agentIds: input.agentIds,
            archived: input.archived,
            displayName: input.displayName,
        },
    };
}

function isArchivedTavernChat(chat: AgentRuntimeChat) {
    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : null;

    return tavern?.archived === true;
}
