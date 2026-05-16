import type { AgentRuntimeSessionMessage } from '@tavern/agent-runtime-protocol';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';

interface MessageFingerprint {
    content: string;
    sessionKey: string;
    timestamp: string;
}

export async function filterDuplicateTavernAcceptedInboundMessages(input: {
    messages: AgentRuntimeSessionMessage[];
    sessionKey: string;
}) {
    const acceptedMessages = [
        ...(await listProjectedTavernAcceptedInboundMessages(input.sessionKey)),
    ];
    const filtered: AgentRuntimeSessionMessage[] = [];

    for (const message of input.messages) {
        if (isDuplicateOpenClawInboundMessage(message, acceptedMessages)) {
            continue;
        }

        filtered.push(message);

        if (isTavernAcceptedInboundMessage(message)) {
            acceptedMessages.push(toFingerprint(message));
        }
    }

    return filtered;
}

async function listProjectedTavernAcceptedInboundMessages(sessionKey: string) {
    const rows = await db
        .select({
            content: sessionMessagesTable.contentText,
            rawJson: sessionMessagesTable.rawJson,
            sessionKey: sessionMessagesTable.sessionKey,
            timestamp: sessionMessagesTable.timestamp,
        })
        .from(sessionMessagesTable)
        .where(
            and(
                eq(sessionMessagesTable.sessionKey, sessionKey),
                eq(sessionMessagesTable.role, 'user')
            )
        );

    return rows.flatMap((row) => {
        if (!(row.timestamp && isTavernAcceptedInboundRawJson(row.rawJson))) {
            return [];
        }

        return [
            {
                content: row.content ?? '',
                sessionKey: row.sessionKey,
                timestamp: row.timestamp,
            },
        ];
    });
}

export function isTavernAcceptedInboundRawJson(rawJson: string) {
    try {
        const parsed = JSON.parse(rawJson) as Partial<AgentRuntimeSessionMessage>;
        const metadata = parsed.metadata as
            | { tavern?: { acceptedRunId?: unknown; acceptedRuntimeId?: unknown } }
            | undefined;

        return (
            parsed.senderType === 'user' &&
            (typeof metadata?.tavern?.acceptedRunId === 'string' ||
                typeof metadata?.tavern?.acceptedRuntimeId === 'string' ||
                (parsed.sender === 'tavern:user' && parsed.senderName === 'Tavern') ||
                (parsed.sender === 'Tavern' && parsed.senderName === 'Tavern'))
        );
    } catch {
        return false;
    }
}

function isTavernAcceptedInboundMessage(message: AgentRuntimeSessionMessage) {
    return (
        message.senderType === 'user' &&
        !message.chatId.startsWith('openclaw:') &&
        (message.sender === 'tavern:user' ||
            (message.sender === 'Tavern' && message.senderName === 'Tavern') ||
            typeof message.metadata?.tavern?.acceptedRunId === 'string')
    );
}

function isDuplicateOpenClawInboundMessage(
    message: AgentRuntimeSessionMessage,
    acceptedMessages: MessageFingerprint[]
) {
    if (message.senderType !== 'user' || isTavernAcceptedInboundMessage(message)) {
        return false;
    }

    const messageAt = Date.parse(message.timestamp);

    if (!Number.isFinite(messageAt)) {
        return false;
    }

    return acceptedMessages.some((accepted) => {
        const acceptedAt = Date.parse(accepted.timestamp);

        return (
            accepted.content === message.content &&
            accepted.sessionKey === message.sessionKey &&
            Number.isFinite(acceptedAt) &&
            Math.abs(messageAt - acceptedAt) < 60_000
        );
    });
}

function toFingerprint(message: AgentRuntimeSessionMessage): MessageFingerprint {
    return {
        content: message.content,
        sessionKey: message.sessionKey,
        timestamp: message.timestamp,
    };
}
