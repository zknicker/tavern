import {
    type AgentRuntimeSessionMessage,
    type AgentRuntimeSessionMessageAttachment,
    type AgentRuntimeSessionMessageList,
    agentRuntimeSessionMessageListSchema,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readArray,
    readNumber,
    readString,
    requireIsoString,
    requireString,
} from '../../gateway/records.ts';
import { resolveOpenClawDiscordMessageParticipant } from '../../platforms/discord/message.ts';
import { normalizeOpenClawModelProvider } from '../models/list.ts';

export function mapOpenClawSessionMessages(input: {
    chatId?: string | null;
    messages: unknown;
    sessionKey: string;
}): AgentRuntimeSessionMessageList {
    const record = asRecord(input.messages);
    const messages = collapseTavernAcceptedInboundDuplicates(
        readArray(record.messages ?? record.items ?? input.messages).map((message, index) =>
            mapMessageRecord({
                chatId: input.chatId ?? `openclaw:${input.sessionKey}`,
                index,
                message,
                sessionKey: input.sessionKey,
            })
        )
    );

    return agentRuntimeSessionMessageListSchema.parse({ messages });
}

function mapMessageRecord(input: {
    chatId: string;
    index: number;
    message: unknown;
    sessionKey: string;
}): AgentRuntimeSessionMessage {
    const record = asRecord(input.message);
    const role = requireString(record, ['role', 'senderType'], 'OpenClaw message');
    const senderType =
        role === 'assistant' || role === 'agent' ? 'agent' : role === 'user' ? 'user' : 'system';
    const openClawMeta = asRecord(record.__openclaw);
    const id =
        readString(openClawMeta, ['id']) ??
        readString(record, ['id', 'messageId', 'idempotencyKey']);
    const agentId = readString(record, ['agentId', 'agent']);
    const openClawApi = readString(record, ['api']);
    const openClawModel = readString(record, ['model']);
    const openClawProvider = readString(record, ['provider']);
    const recordMetadata = asRecord(record.metadata);

    if (!id) {
        throw new Error(
            `OpenClaw message ${input.sessionKey}[${input.index}] is missing a stable id.`
        );
    }

    return {
        agentId,
        attachments: mapOpenClawAttachments(record),
        chatId: readString(record, ['chatId']) ?? input.chatId,
        content: resolveMessageContent(record),
        id,
        metadata: {
            ...recordMetadata,
            api: openClawApi,
            isError: typeof record.isError === 'boolean' ? record.isError : undefined,
            model: openClawModel ?? undefined,
            openClawApi: openClawApi ?? undefined,
            openClawModel: openClawModel ?? undefined,
            openClawProvider: openClawProvider ?? undefined,
            parts: Array.isArray(record.content)
                ? (record.content as Record<string, unknown>[])
                : undefined,
            provider: normalizeOpenClawModelProvider(openClawProvider) ?? undefined,
            stopReason: readString(record, ['stopReason']) ?? undefined,
            toolCallId: readString(record, ['toolCallId']) ?? undefined,
            toolName: readString(record, ['toolName']) ?? undefined,
            toolResult: record.details,
            usage: record.usage,
        },
        participant:
            senderType === 'user' ? resolveOpenClawDiscordMessageParticipant(record) : null,
        sender: readString(record, ['sender', 'role']) ?? senderType,
        senderName: readString(record, ['senderName', 'name', 'senderLabel']) ?? senderType,
        senderType,
        sessionKey: readString(record, ['sessionKey']) ?? input.sessionKey,
        timestamp: requireIsoString(
            record.timestamp ?? record.createdAt ?? record.time,
            `OpenClaw message ${id}`
        ),
    };
}

function mapOpenClawAttachments(
    record: Record<string, unknown>
): AgentRuntimeSessionMessageAttachment[] | undefined {
    const rawAttachments = [
        ...readArray(record.attachments),
        ...readArray(record.content).filter((part) => {
            const partRecord = asRecord(part);
            const type = readString(partRecord, ['type']);
            return type !== null && type !== 'text';
        }),
    ];
    const attachments = rawAttachments.flatMap((attachment, index) => {
        const mapped = mapOpenClawAttachment(asRecord(attachment), index);
        return mapped ? [mapped] : [];
    });

    return attachments.length > 0 ? attachments : undefined;
}

function mapOpenClawAttachment(
    record: Record<string, unknown>,
    index: number
): AgentRuntimeSessionMessageAttachment | null {
    const reference = asRecord(record.reference);
    const mediaType = readString(record, ['mediaType', 'mimeType']) ?? 'application/octet-stream';
    const filename =
        readString(record, ['filename', 'name']) ??
        filenameFromPath(readString(reference, ['path']) ?? readString(record, ['path'])) ??
        `attachment-${index + 1}`;
    const inlineBase64 =
        readString(record, ['dataBase64', 'content', 'base64', 'data']) ??
        readString(asRecord(record.inline), ['base64']);

    if (inlineBase64) {
        return {
            dataBase64: inlineBase64,
            filename,
            height: readNumber(record, ['height']) ?? undefined,
            mediaType,
            sizeBytes:
                readNumber(record, ['sizeBytes', 'base64Bytes']) ??
                Math.floor((inlineBase64.length * 3) / 4),
            type: 'inline',
            width: readNumber(record, ['width']) ?? undefined,
        };
    }

    const path = readString(reference, ['path']) ?? readString(record, ['path', 'filePath']);

    if (!path) {
        return null;
    }

    return {
        filename,
        mediaType,
        path,
        sizeBytes: readNumber(record, ['sizeBytes']) ?? null,
        type: 'file',
        uri: readString(reference, ['uri']) ?? readString(record, ['uri', 'url']),
    };
}

function filenameFromPath(value: string | null) {
    if (!value) {
        return null;
    }

    return value.split('/').filter(Boolean).at(-1) ?? null;
}

function resolveMessageContent(record: Record<string, unknown>) {
    const direct = readString(record, ['content', 'text', 'message']);

    if (direct) {
        return direct;
    }

    if (!Array.isArray(record.content)) {
        return '';
    }

    return record.content
        .map((part) => {
            if (typeof part === 'string') {
                return part;
            }

            const partRecord = asRecord(part);
            return readString(partRecord, ['text', 'content']) ?? '';
        })
        .filter((part) => part.length > 0)
        .join('\n');
}

function collapseTavernAcceptedInboundDuplicates(messages: AgentRuntimeSessionMessage[]) {
    const acceptedInboundMessages: AgentRuntimeSessionMessage[] = [];
    const collapsed: AgentRuntimeSessionMessage[] = [];

    for (const message of messages) {
        if (isDuplicateOpenClawInboundMessage(message, acceptedInboundMessages)) {
            continue;
        }

        collapsed.push(message);

        if (isTavernAcceptedInboundMessage(message)) {
            acceptedInboundMessages.push(message);
        }
    }

    return collapsed;
}

function isTavernAcceptedInboundMessage(message: AgentRuntimeSessionMessage) {
    return (
        message.senderType === 'user' &&
        message.sender === 'Tavern' &&
        message.senderName === 'Tavern' &&
        !message.chatId.startsWith('openclaw:')
    );
}

function isDuplicateOpenClawInboundMessage(
    message: AgentRuntimeSessionMessage,
    acceptedInboundMessages: AgentRuntimeSessionMessage[]
) {
    if (!(message.senderType === 'user' && message.chatId.startsWith('openclaw:'))) {
        return false;
    }

    const messageAt = Date.parse(message.timestamp);

    if (!Number.isFinite(messageAt)) {
        return false;
    }

    return acceptedInboundMessages.some((accepted) => {
        const acceptedAt = Date.parse(accepted.timestamp);

        return (
            accepted.content === message.content &&
            accepted.sessionKey === message.sessionKey &&
            Number.isFinite(acceptedAt) &&
            Math.abs(messageAt - acceptedAt) < 60_000
        );
    });
}
