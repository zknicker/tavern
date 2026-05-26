import { listAgents } from '../agents/catalog.ts';
import {
    type SessionHistory,
    type SessionMessage,
    sessionMessageAttachmentSchema,
} from '../sessions/contracts.ts';
import { listSessionMessagesForSessionKeys } from '../storage/session-messages.ts';
import { listSessionToolCalls } from '../storage/session-tool-calls.ts';
import { listSessionRecords, parseSessionRecord } from '../storage/sessions.ts';
import { buildChatRows } from './rows.ts';
import { getRuntimeChatRecord, runtimeChatSessionKeys } from './runtime-chats.ts';

export async function listAgentRuntimeChatRows(
    chatId: string
): Promise<SessionHistory['rows'] | null> {
    const chatRecord = await getRuntimeChatRecord(chatId);

    if (!chatRecord) {
        return null;
    }

    return await listChatRowsFromSessionRecords(chatId);
}

async function listChatRowsFromSessionRecords(chatId: string): Promise<SessionHistory['rows']> {
    const [agents, chatRecord, sessionRecords] = await Promise.all([
        listAgents(),
        getRuntimeChatRecord(chatId),
        listSessionRecords(),
    ]);
    const chatSessionKeys = chatRecord ? runtimeChatSessionKeys(chatRecord.chat) : [];
    const sessions = sessionRecords.flatMap((record) => {
        const session = parseSessionRecord(record);
        return session && session.chatId === chatId && session.sessionRole === 'main'
            ? [session]
            : [];
    });
    const sessionKeys = [
        ...new Set([...sessions.map((session) => session.key), ...chatSessionKeys]),
    ];
    const sessionsByKey = new Map(sessions.map((session) => [session.key, session]));
    const [messages, toolCalls] = await Promise.all([
        listSessionMessagesForSessionKeys(sessionKeys),
        listSessionToolCalls(sessionKeys),
    ]);
    const agentLookup = {
        byAlias: new Map(),
        byDiscordId: new Map(),
        byId: new Map(
            agents.map((agent) => [
                agent.id,
                {
                    agentId: agent.id,
                    displayName: agent.name,
                },
            ])
        ),
    };

    return buildChatRows({
        agentLookup,
        messages: messages.map((message) => {
            const actor = resolveMessageActor(message);
            const agentId = actor?.kind === 'agent' ? actor.id : null;
            const sourceSessionId = sessionsByKey.get(message.sessionKey)?.sessionId ?? null;

            return {
                agentId,
                message: {
                    actor: actor?.id ? actor : null,
                    tavernAgentId: agentId,
                    attachments: parseMessageAttachments(message.rawJson),
                    content: message.contentText ?? '',
                    id: message.id,
                    metadata: resolveMessageMetadata(message),
                    sender: message.senderLabel ?? message.role,
                    senderType:
                        message.role === 'agent' || message.role === 'user'
                            ? message.role
                            : 'system',
                    sourceSessionId,
                    sourceSessionKey: message.sessionKey,
                    timestamp: message.timestamp ?? message.syncedAt,
                },
            };
        }),
        toolCalls,
        workers: [],
    });
}

function parseMessageRaw(messageJson: string | null) {
    if (!messageJson) {
        return null;
    }

    try {
        const parsed = JSON.parse(messageJson) as {
            attachments?: unknown;
            metadata?: Record<string, unknown> | null;
        };

        return { metadata: parsed.metadata ?? null };
    } catch {
        return null;
    }
}

function parseMessageAttachments(messageJson: string | null) {
    if (!messageJson) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(messageJson) as { attachments?: unknown };

        if (!Array.isArray(parsed.attachments)) {
            return undefined;
        }

        const attachments = parsed.attachments.flatMap(mapAttachment);

        return attachments.length > 0 ? attachments : undefined;
    } catch {
        return undefined;
    }
}

function mapAttachment(attachment: unknown, index: number) {
    const result = sessionMessageAttachmentSchema.safeParse(attachment);

    if (result.success) {
        return [result.data];
    }

    if (!(attachment && typeof attachment === 'object')) {
        return [];
    }

    const record = attachment as Record<string, unknown>;
    const reference =
        record.reference && typeof record.reference === 'object'
            ? (record.reference as Record<string, unknown>)
            : {};
    const dataBase64 = readAttachmentString(record, ['dataBase64', 'content', 'base64', 'data']);
    const mediaType = readAttachmentString(record, ['mediaType', 'mimeType']);
    const filename =
        readAttachmentString(record, ['filename', 'name']) ??
        filenameFromPath(
            readAttachmentString(reference, ['path']) ?? readAttachmentString(record, ['path'])
        ) ??
        `attachment-${index + 1}`;

    if (dataBase64 && mediaType) {
        return [
            {
                dataBase64,
                filename,
                height: readAttachmentNumber(record, ['height']) ?? undefined,
                mediaType,
                sizeBytes:
                    readAttachmentNumber(record, ['sizeBytes', 'base64Bytes']) ??
                    Math.floor((dataBase64.length * 3) / 4),
                type: 'inline' as const,
                width: readAttachmentNumber(record, ['width']) ?? undefined,
            },
        ];
    }

    const path =
        readAttachmentString(reference, ['path']) ?? readAttachmentString(record, ['path']);

    if (!path) {
        return [];
    }

    return [
        {
            filename,
            mediaType,
            path,
            sizeBytes: readAttachmentNumber(record, ['sizeBytes']) ?? null,
            type: 'file' as const,
            uri: readAttachmentString(reference, ['uri']) ?? readAttachmentString(record, ['uri']),
        },
    ];
}

function readAttachmentString(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

function readAttachmentNumber(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }

    return null;
}

function filenameFromPath(value: string | null) {
    return value?.split('/').filter(Boolean).at(-1) ?? null;
}

function parseUsage(usageJson: string | null) {
    if (!usageJson) {
        return undefined;
    }

    try {
        return JSON.parse(usageJson) as unknown;
    } catch {
        return undefined;
    }
}

function resolveMessageMetadata(message: {
    api: string | null;
    model: string | null;
    openClawApi: string | null;
    openClawHarness: string | null;
    openClawModel: string | null;
    openClawProvider: string | null;
    provider: string | null;
    rawJson: string | null;
    stopReason: string | null;
    usageJson: string | null;
}): SessionMessage['metadata'] {
    const rawMetadata = parseMessageRaw(message.rawJson)?.metadata ?? {};
    const metadata = compactMetadata(rawMetadata, ['model', 'provider']);
    const usage = parseUsage(message.usageJson);

    if (message.api) {
        metadata.api = message.api;
    }

    if (message.model && isModelProvider(message.provider)) {
        metadata.model = message.model;
        metadata.provider = message.provider;
    }

    if (message.openClawApi) {
        metadata.openClawApi = message.openClawApi;
    }

    if (message.openClawHarness === 'pi' || message.openClawHarness === 'codex') {
        metadata.openClawHarness = message.openClawHarness;
    }

    if (message.openClawModel) {
        metadata.openClawModel = message.openClawModel;
    }

    if (message.openClawProvider) {
        metadata.openClawProvider = message.openClawProvider;
    }

    if (message.stopReason) {
        metadata.stopReason = message.stopReason;
    }

    if (usage !== undefined) {
        metadata.usage = usage;
    }

    return metadata as SessionMessage['metadata'];
}

function compactMetadata(
    metadata: Record<string, unknown>,
    excludedKeys: string[]
): Record<string, unknown> {
    const excluded = new Set(excludedKeys);

    return Object.fromEntries(
        Object.entries(metadata).filter(
            ([key, value]) => !(excluded.has(key) || value === null || value === undefined)
        )
    );
}

function isModelProvider(value: string | null): value is 'claude' | 'codex' | 'openrouter' {
    return value === 'claude' || value === 'codex' || value === 'openrouter';
}

function resolveMessageActor(message: { actorId: string | null; actorKind: string | null }) {
    if (
        !(message.actorId && (message.actorKind === 'agent' || message.actorKind === 'participant'))
    ) {
        return null;
    }

    return {
        id: message.actorId,
        kind: message.actorKind,
    } as const;
}
