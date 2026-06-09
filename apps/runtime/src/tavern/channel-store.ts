import type {
    TavernChannelConversation,
    TavernChannelHistoryEntry,
    TavernChannelInboundMessage,
    TavernChatMessage,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams, optionalRow } from '../db/sqlite';
import { getChat, getMessage, listRecentMessagesBefore } from './chat-api';
import { createRunId } from './chat-api/ids';

const recentHistoryLimit = 20;

export interface PersistInboundMessageInput {
    accountId: string;
    agentId: string;
    chatId: string;
    conversation: TavernChannelConversation;
    cursor: number | string;
    messageId: string;
    requestId: string;
    sessionKey: string;
}

export interface PersistedInboundMessage {
    acceptedAt: string;
    cursor: number;
    frame: TavernChannelInboundMessage;
    messageId: string;
    runId: string;
    sequence: number;
    sessionKey: string;
}

interface OutboxRow {
    accepted_at: string;
    account_id: string;
    agent_id: string;
    chat_id: string;
    conversation_kind: TavernChannelConversation['kind'];
    cursor: number;
    message_id: string;
    plugin_accepted_at: string | null;
    request_id: string;
    run_id: string;
    session_key: string;
}

export function persistTavernInboundMessage(
    input: PersistInboundMessageInput,
    db: Database = getDb()
): PersistedInboundMessage {
    const existing = findExistingInbound(input, db);

    if (existing) {
        return rowToPersistedInbound(existing, input, db);
    }

    const message = getMessageOrThrow(input.messageId, db);
    const acceptedAt = new Date().toISOString();
    const runId = createRunId(message.id);
    const cursor = Number(input.cursor);

    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `INSERT INTO tavern_channel_outbox (
              request_id, message_id, chat_id, conversation_kind, account_id, agent_id,
              session_key, run_id, cursor, accepted_at
            ) VALUES (
              $requestId, $messageId, $chatId, $conversationKind, $accountId, $agentId,
              $sessionKey, $runId, $cursor, $acceptedAt
            )`
        ).run(
            namedParams({
                acceptedAt,
                accountId: input.accountId,
                agentId: input.agentId,
                chatId: input.chatId,
                conversationKind: input.conversation.kind,
                cursor,
                messageId: message.id,
                requestId: input.requestId,
                runId,
                sessionKey: input.sessionKey,
            })
        );
        db.exec('COMMIT');

        const row = getOutboxMessageOrThrow(input.messageId, db);

        return {
            acceptedAt,
            cursor,
            frame: buildInboundFrame({ conversation: input.conversation, db, message, row }),
            messageId: message.id,
            runId,
            sequence: message.sequence,
            sessionKey: input.sessionKey,
        };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function listPendingTavernInboundMessages(
    db: Database = getDb()
): TavernChannelInboundMessage[] {
    const rows = db
        .prepare(
            `SELECT *
             FROM tavern_channel_outbox
             WHERE plugin_accepted_at IS NULL
             ORDER BY cursor ASC
             LIMIT 100`
        )
        .all() as OutboxRow[];

    return rows.map(
        (row) =>
            rowToPersistedInbound(
                row,
                {
                    accountId: row.account_id,
                    agentId: row.agent_id,
                    chatId: row.chat_id,
                    conversation: buildStoredConversation(row.chat_id, row.conversation_kind, db),
                    cursor: row.cursor,
                    messageId: row.message_id,
                    requestId: row.request_id,
                    sessionKey: row.session_key,
                },
                db
            ).frame
    );
}

export function markTavernInboundMessageAccepted(
    requestId: string,
    acceptedAt: string,
    db: Database = getDb()
): void {
    db.prepare(
        `UPDATE tavern_channel_outbox
         SET plugin_accepted_at = COALESCE(plugin_accepted_at, $acceptedAt)
         WHERE request_id = $requestId OR message_id = $requestId`
    ).run(namedParams({ acceptedAt, requestId }));
}

function findExistingInbound(input: PersistInboundMessageInput, db: Database): OutboxRow | null {
    const byId = optionalRow(
        db
            .prepare('SELECT * FROM tavern_channel_outbox WHERE message_id = $messageId')
            .get(namedParams({ messageId: input.messageId })) as OutboxRow | null
    );

    if (byId) {
        assertSameInbound(input, byId);
        return byId;
    }

    return null;
}

function buildStoredConversation(
    chatId: string,
    kind: TavernChannelConversation['kind'],
    db: Database
): TavernChannelConversation {
    const chat = getChat(chatId, db);
    const tavern =
        chat?.metadata.tavern &&
        typeof chat.metadata.tavern === 'object' &&
        !Array.isArray(chat.metadata.tavern)
            ? (chat.metadata.tavern as Record<string, unknown>)
            : {};
    const displayName = readNonEmptyString(tavern.displayName);
    const displayNameSource = tavern.displayNameSource === 'explicit' ? 'explicit' : 'generated';
    const label = chat?.pinned || displayNameSource === 'explicit' ? displayName : null;
    const groupSystemPrompt = chat?.pinned ? readNonEmptyString(tavern.groupSystemPrompt) : null;

    return {
        id: chatId,
        kind,
        label,
        ...(label ? { groupChannel: label, groupSubject: label } : {}),
        ...(groupSystemPrompt ? { groupSystemPrompt } : {}),
        parentId: null,
        threadRootId: null,
    };
}

function readNonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function assertSameInbound(input: PersistInboundMessageInput, row: OutboxRow): void {
    if (
        row.chat_id !== input.chatId ||
        row.agent_id !== input.agentId ||
        row.session_key !== input.sessionKey ||
        row.message_id !== input.messageId
    ) {
        throw new Error('Tavern channel outbox message was already used for a different delivery.');
    }
}

function rowToPersistedInbound(
    row: OutboxRow,
    input: PersistInboundMessageInput,
    db: Database
): PersistedInboundMessage {
    const message = getMessageOrThrow(row.message_id, db);

    return {
        acceptedAt: row.accepted_at,
        cursor: row.cursor,
        frame: buildInboundFrame({
            conversation: {
                ...input.conversation,
                kind: row.conversation_kind,
            },
            db,
            message,
            row,
        }),
        messageId: row.message_id,
        runId: row.run_id,
        sequence: message.sequence,
        sessionKey: row.session_key,
    };
}

function buildInboundFrame(input: {
    conversation: TavernChannelConversation;
    db: Database;
    message: TavernChatMessage;
    row: OutboxRow;
}): TavernChannelInboundMessage {
    return {
        accountId: input.row.account_id,
        agentId: input.row.agent_id,
        conversation: input.conversation,
        cursor: input.row.cursor,
        kind: 'inbound-message',
        message: {
            attachments: input.message.attachments,
            author: {
                id: input.message.author.id,
                name: input.message.author.label ?? input.message.author.id,
            },
            id: input.message.id,
            metadata: input.message.metadata,
            nonce: input.message.nonce ?? undefined,
            parentMessageId: input.message.parent_message_id,
            senderId: input.message.author.id,
            senderName: input.message.author.label ?? input.message.author.id,
            sequence: input.message.sequence,
            text: messageText(input.message),
            threadRootId: input.message.thread_root_id ?? input.message.id,
            timestamp: input.message.created_at,
        },
        recentMessages: listRecentMessagesBefore(
            input.message.chat_id,
            {
                beforeSequence: input.message.sequence,
                limit: recentHistoryLimit,
            },
            input.db
        ).map(messageToHistoryEntry),
        requestId: input.row.request_id,
        sessionKey: input.row.session_key,
        turnId: input.row.run_id,
    };
}

function getOutboxMessageOrThrow(messageId: string, db: Database): OutboxRow {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM tavern_channel_outbox WHERE message_id = $messageId')
            .get(namedParams({ messageId })) as OutboxRow | null
    );

    if (!row) {
        throw new Error(`Missing Tavern channel outbox message ${messageId}.`);
    }

    return row;
}

function getMessageOrThrow(messageId: string, db: Database = getDb()): TavernChatMessage {
    const message = getMessage(messageId, db);
    if (!message) {
        throw new Error(`Missing Tavern chat message ${messageId}.`);
    }
    return message;
}

function messageText(message: TavernChatMessage) {
    return message.content;
}

function messageToHistoryEntry(message: TavernChatMessage): TavernChannelHistoryEntry {
    return {
        body: messageText(message),
        messageId: message.id,
        sender: message.author.label ?? message.author.id,
        timestamp: Date.parse(message.created_at),
    };
}
