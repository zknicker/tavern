import type {
    AgentRuntimeChatStatus,
    AgentRuntimeEvent,
    AgentRuntimeTurnProgressStep,
    TavernChannelConversation,
    TavernChannelInboundMessage,
} from '@tavern/agent-runtime-protocol';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams, optionalRow } from '../db/sqlite';

export interface PersistInboundMessageInput {
    accountId: string;
    agentId: string;
    chatId: string;
    conversation: TavernChannelConversation;
    message: {
        content: string;
        id: string;
        metadata?: Record<string, unknown>;
        nonce?: string;
        parentMessageId?: string | null;
        threadRootId?: string | null;
    };
    requestId: string;
    sentAt: string;
    sessionKey: string;
}

export interface PersistedInboundMessage {
    acceptedAt: string;
    acceptedEvent: AgentRuntimeEvent;
    cursor: number;
    frame: TavernChannelInboundMessage;
    messageId: string;
    runId: string;
    sequence: number;
    sessionKey: string;
}

export interface PersistRuntimeEventInput {
    deliveryId?: string | null;
    event: AgentRuntimeEvent;
}

export interface MarkTavernChannelReadInput {
    agentId?: string | null;
    chatId: string;
    lastReadSequence: number;
    readAt?: string;
    readerId: string;
    sessionKey?: string | null;
}

export interface PersistedRuntimeEvent {
    cursor: number;
    event: AgentRuntimeEvent;
}

interface MessageRow {
    accepted_at: string;
    account_id: string;
    agent_id: string;
    body: string;
    chat_id: string;
    conversation_kind: TavernChannelConversation['kind'];
    cursor: number;
    id: string;
    metadata_json: string;
    nonce: string | null;
    parent_message_id: string | null;
    plugin_accepted_at: string | null;
    request_id: string;
    run_id: string;
    sender_id: string;
    sender_name: string;
    sent_at: string;
    sequence: number;
    session_key: string;
    thread_root_id: string | null;
}

interface EventRow {
    cursor: number;
    event_json: string;
}

interface ReadRow {
    agent_id: string | null;
    chat_id: string;
    last_read_sequence: number;
    read_at: string;
    reader_id: string;
    session_key: string | null;
}

export function persistTavernInboundMessage(
    input: PersistInboundMessageInput,
    db: Database = getDb()
): PersistedInboundMessage {
    const existing = findExistingInbound(input, db);

    if (existing) {
        return rowToPersistedInbound(existing, input);
    }

    const acceptedAt = new Date().toISOString();
    const runId = `tavern-run:${input.message.id}`;

    db.exec('BEGIN IMMEDIATE');
    try {
        const sequence = nextSequence(input.chatId, db);
        const cursor = nextMessageCursor(db);

        db.prepare(
            `INSERT INTO tavern_channel_messages (
              id, chat_id, conversation_kind, account_id, agent_id, session_key, request_id, run_id, nonce,
              parent_message_id, thread_root_id, sender_id, sender_name, body, metadata_json,
              sequence, cursor, accepted_at, sent_at
            ) VALUES (
              $id, $chatId, $conversationKind, $accountId, $agentId, $sessionKey, $requestId, $runId, $nonce,
              $parentMessageId, $threadRootId, $senderId, $senderName, $body, $metadataJson,
              $sequence, $cursor, $acceptedAt, $sentAt
            )`
        ).run(
            namedParams({
                acceptedAt,
                accountId: input.accountId,
                agentId: input.agentId,
                body: input.message.content,
                chatId: input.chatId,
                conversationKind: input.conversation.kind,
                cursor,
                id: input.message.id,
                metadataJson: JSON.stringify(input.message.metadata ?? {}),
                nonce: input.message.nonce ?? null,
                parentMessageId:
                    input.message.parentMessageId ?? input.conversation.parentId ?? null,
                requestId: input.requestId,
                runId,
                senderId: 'tavern:user',
                senderName: 'Tavern',
                sentAt: input.sentAt,
                sequence,
                sessionKey: input.sessionKey,
                threadRootId:
                    input.message.threadRootId ??
                    input.conversation.threadRootId ??
                    input.message.id,
            })
        );
        const acceptedEvent = insertAcceptedMessageEvent(
            {
                acceptedAt,
                cursor,
                input,
                runId,
                sequence,
            },
            db
        );
        db.exec('COMMIT');

        return {
            acceptedAt,
            acceptedEvent: acceptedEvent.event,
            cursor,
            frame: buildInboundFrame({
                accountId: input.accountId,
                agentId: input.agentId,
                conversation: input.conversation,
                cursor,
                message: input.message,
                requestId: input.requestId,
                runId,
                sequence,
                sentAt: input.sentAt,
                sessionKey: input.sessionKey,
            }),
            messageId: input.message.id,
            runId,
            sequence,
            sessionKey: input.sessionKey,
        };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function persistTavernRuntimeEvent(
    input: PersistRuntimeEventInput,
    db: Database = getDb()
): PersistedRuntimeEvent {
    if (input.deliveryId) {
        const existing = optionalRow(
            db
                .prepare(
                    'SELECT cursor, event_json FROM tavern_channel_events WHERE delivery_id = $deliveryId'
                )
                .get(namedParams({ deliveryId: input.deliveryId })) as EventRow | null
        );

        if (existing) {
            return {
                cursor: existing.cursor,
                event: JSON.parse(existing.event_json) as AgentRuntimeEvent,
            };
        }
    }

    return insertRuntimeEvent(input, db);
}

export function listPendingTavernInboundMessages(
    db: Database = getDb()
): TavernChannelInboundMessage[] {
    const rows = db
        .prepare(
            `SELECT *
             FROM tavern_channel_messages
             WHERE plugin_accepted_at IS NULL
             ORDER BY cursor ASC
             LIMIT 100`
        )
        .all() as MessageRow[];

    return rows.map(
        (row) =>
            rowToPersistedInbound(row, {
                accountId: row.account_id,
                agentId: row.agent_id,
                chatId: row.chat_id,
                conversation: {
                    id: row.chat_id,
                    kind: row.conversation_kind,
                    label: row.chat_id,
                    parentId: row.parent_message_id,
                    threadRootId: row.thread_root_id,
                },
                message: {
                    content: row.body,
                    id: row.id,
                    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
                    nonce: row.nonce ?? undefined,
                    parentMessageId: row.parent_message_id,
                    threadRootId: row.thread_root_id,
                },
                requestId: row.request_id,
                sentAt: row.sent_at,
                sessionKey: row.session_key,
            }).frame
    );
}

export function markTavernInboundMessageAccepted(
    requestId: string,
    acceptedAt: string,
    db: Database = getDb()
): void {
    db.prepare(
        `UPDATE tavern_channel_messages
         SET plugin_accepted_at = COALESCE(plugin_accepted_at, $acceptedAt)
         WHERE request_id = $requestId OR id = $requestId`
    ).run(namedParams({ acceptedAt, requestId }));
}

export function listTavernRuntimeEvents(
    options: { afterCursor?: number; limit?: number } = {},
    db: Database = getDb()
): PersistedRuntimeEvent[] {
    const afterCursor = options.afterCursor ?? 0;
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 500);
    const rows = db
        .prepare(
            `SELECT cursor, event_json
             FROM tavern_channel_events
             WHERE cursor > $afterCursor
             ORDER BY cursor ASC
             LIMIT $limit`
        )
        .all(namedParams({ afterCursor, limit })) as EventRow[];

    return rows.map((row) => ({
        cursor: row.cursor,
        event: JSON.parse(row.event_json) as AgentRuntimeEvent,
    }));
}

export function listTavernActiveChannelStatuses(db: Database = getDb()): AgentRuntimeChatStatus[] {
    const messageRows = db
        .prepare(
            `SELECT *
             FROM tavern_channel_messages
             WHERE plugin_accepted_at IS NOT NULL
             ORDER BY cursor ASC`
        )
        .all() as MessageRow[];
    const eventRows = db
        .prepare(
            `SELECT cursor, event_json
             FROM tavern_channel_events
             WHERE event_type IN ('turn.started', 'turn.progress', 'turn.replyUpdated', 'turn.completed', 'turn.failed')
             ORDER BY cursor ASC`
        )
        .all() as EventRow[];
    const activeStatuses = new Map<string, AgentRuntimeChatStatus>();

    for (const row of messageRows) {
        activeStatuses.set(row.run_id, {
            activeReply: {
                agentId: row.agent_id,
                isThinking: true,
                runId: row.run_id,
                sessionKey: row.session_key,
                startedAt: row.plugin_accepted_at ?? row.accepted_at,
                text: '',
            },
            chatId: row.chat_id,
        });
    }

    for (const row of eventRows) {
        const event = JSON.parse(row.event_json) as AgentRuntimeEvent;

        switch (event.type) {
            case 'turn.started': {
                const current = activeStatuses.get(event.turn.runId);
                activeStatuses.set(event.turn.runId, {
                    activeReply: {
                        agentId: event.turn.agentId,
                        isThinking: true,
                        runId: event.turn.runId,
                        sessionKey: event.turn.sessionKey,
                        startedAt: event.turn.startedAt,
                        text: '',
                    },
                    ...(current?.activeReplyProgressStartedAt
                        ? { activeReplyProgressStartedAt: current.activeReplyProgressStartedAt }
                        : {}),
                    ...(current?.activeReplySteps?.length
                        ? { activeReplySteps: current.activeReplySteps }
                        : {}),
                    chatId: event.turn.chatId,
                });
                break;
            }
            case 'turn.replyUpdated': {
                const current = activeStatuses.get(event.turn.runId);
                activeStatuses.set(event.turn.runId, {
                    activeReply: {
                        agentId: event.turn.agentId,
                        isThinking: event.isThinking ?? true,
                        runId: event.turn.runId,
                        sessionKey: event.turn.sessionKey,
                        startedAt: event.turn.startedAt,
                        text: event.text,
                    },
                    ...(current?.activeReplyProgressStartedAt
                        ? { activeReplyProgressStartedAt: current.activeReplyProgressStartedAt }
                        : {}),
                    ...(current?.activeReplySteps?.length
                        ? { activeReplySteps: current.activeReplySteps }
                        : {}),
                    chatId: event.turn.chatId,
                });
                break;
            }
            case 'turn.progress': {
                activeStatuses.set(
                    event.turn.runId,
                    applyProgressToStatus(activeStatuses.get(event.turn.runId), event)
                );
                break;
            }
            case 'turn.completed':
            case 'turn.failed': {
                activeStatuses.delete(event.turn.runId);
                break;
            }
            default:
                break;
        }
    }

    return [...activeStatuses.values()];
}

function applyProgressToStatus(
    status: AgentRuntimeChatStatus | undefined,
    event: Extract<AgentRuntimeEvent, { type: 'turn.progress' }>
): AgentRuntimeChatStatus {
    const steps = upsertProgressStep(status?.activeReplySteps ?? [], event.step);

    return {
        activeReply: status?.activeReply ?? {
            agentId: event.turn.agentId,
            isThinking: true,
            runId: event.turn.runId,
            sessionKey: event.turn.sessionKey,
            startedAt: event.turn.startedAt,
            text: '',
        },
        activeReplyProgressStartedAt: status?.activeReplyProgressStartedAt ?? event.timestamp,
        activeReplySteps: steps,
        chatId: status?.chatId ?? event.turn.chatId,
    };
}

function upsertProgressStep(
    steps: AgentRuntimeTurnProgressStep[],
    step: AgentRuntimeTurnProgressStep
): AgentRuntimeTurnProgressStep[] {
    const existingIndex = steps.findIndex((candidate) => candidate.id === step.id);

    if (existingIndex < 0) {
        return [...steps, step];
    }

    return steps.map((candidate, index) => (index === existingIndex ? step : candidate));
}

export function markTavernChannelRead(
    input: MarkTavernChannelReadInput,
    db: Database = getDb()
): PersistedRuntimeEvent | null {
    if (!Number.isInteger(input.lastReadSequence) || input.lastReadSequence < 1) {
        throw new Error('Tavern read pointers require a positive message sequence.');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        const existing = optionalRow(
            db
                .prepare(
                    `SELECT *
                     FROM tavern_channel_reads
                     WHERE chat_id = $chatId AND reader_id = $readerId`
                )
                .get(
                    namedParams({
                        chatId: input.chatId,
                        readerId: input.readerId,
                    })
                ) as ReadRow | null
        );

        if (existing && existing.last_read_sequence >= input.lastReadSequence) {
            db.exec('COMMIT');
            return null;
        }

        const readAt = input.readAt ?? new Date().toISOString();

        db.prepare(
            `INSERT INTO tavern_channel_reads (
              chat_id, reader_id, session_key, agent_id, last_read_sequence, read_at
            ) VALUES (
              $chatId, $readerId, $sessionKey, $agentId, $lastReadSequence, $readAt
            )
            ON CONFLICT(chat_id, reader_id) DO UPDATE SET
              session_key = excluded.session_key,
              agent_id = excluded.agent_id,
              last_read_sequence = excluded.last_read_sequence,
              read_at = excluded.read_at`
        ).run(
            namedParams({
                agentId: input.agentId ?? null,
                chatId: input.chatId,
                lastReadSequence: input.lastReadSequence,
                readAt,
                readerId: input.readerId,
                sessionKey: input.sessionKey ?? null,
            })
        );

        const event = insertRuntimeEvent(
            {
                deliveryId: `tavern-read:${input.chatId}:${input.readerId}:${input.lastReadSequence}`,
                event: {
                    agentId: input.agentId ?? null,
                    chatId: input.chatId,
                    lastReadSequence: input.lastReadSequence,
                    readerId: input.readerId,
                    sessionKey: input.sessionKey ?? null,
                    timestamp: readAt,
                    type: 'chat.read',
                },
            },
            db
        );
        db.exec('COMMIT');
        return event;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function findExistingInbound(input: PersistInboundMessageInput, db: Database): MessageRow | null {
    const byId = optionalRow(
        db
            .prepare('SELECT * FROM tavern_channel_messages WHERE id = $id')
            .get(namedParams({ id: input.message.id })) as MessageRow | null
    );

    if (byId) {
        assertSameInbound(input, byId);
        return byId;
    }

    if (!input.message.nonce) {
        return null;
    }

    const byNonce = optionalRow(
        db
            .prepare(
                'SELECT * FROM tavern_channel_messages WHERE chat_id = $chatId AND nonce = $nonce'
            )
            .get(
                namedParams({ chatId: input.chatId, nonce: input.message.nonce })
            ) as MessageRow | null
    );

    if (byNonce) {
        assertSameInbound(input, byNonce);
        return byNonce;
    }

    return null;
}

function assertSameInbound(input: PersistInboundMessageInput, row: MessageRow): void {
    if (
        row.chat_id !== input.chatId ||
        row.agent_id !== input.agentId ||
        row.session_key !== input.sessionKey ||
        row.body !== input.message.content
    ) {
        throw new Error('Tavern message id or nonce was already used for a different message.');
    }
}

function rowToPersistedInbound(
    row: MessageRow,
    input: PersistInboundMessageInput
): PersistedInboundMessage {
    return {
        acceptedAt: row.accepted_at,
        acceptedEvent: buildAcceptedMessageEventFromRow(row),
        cursor: row.cursor,
        frame: buildInboundFrame({
            accountId: input.accountId,
            agentId: row.agent_id,
            conversation: {
                ...input.conversation,
                kind: row.conversation_kind,
            },
            cursor: row.cursor,
            message: {
                content: row.body,
                id: row.id,
                metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
                nonce: row.nonce ?? undefined,
                parentMessageId: row.parent_message_id,
                threadRootId: row.thread_root_id,
            },
            requestId: row.request_id,
            runId: row.run_id,
            sequence: row.sequence,
            sentAt: row.sent_at,
            sessionKey: row.session_key,
        }),
        messageId: row.id,
        runId: row.run_id,
        sequence: row.sequence,
        sessionKey: row.session_key,
    };
}

function buildAcceptedMessageEventFromRow(row: MessageRow): AgentRuntimeEvent {
    return {
        agentId: row.agent_id,
        chatId: row.chat_id,
        message: {
            id: row.id,
            nonce: row.nonce ?? undefined,
            parentMessageId: row.parent_message_id,
            senderId: row.sender_id,
            senderName: row.sender_name,
            sequence: row.sequence,
            text: row.body,
            threadRootId: row.thread_root_id ?? row.id,
            timestamp: row.sent_at,
        },
        runId: row.run_id,
        sessionKey: row.session_key,
        timestamp: row.accepted_at,
        type: 'chat.messageAccepted',
    };
}

function buildInboundFrame(input: {
    accountId: string;
    agentId: string;
    conversation: TavernChannelConversation;
    cursor: number;
    message: PersistInboundMessageInput['message'];
    requestId: string;
    runId: string;
    sequence: number;
    sentAt: string;
    sessionKey: string;
}): TavernChannelInboundMessage {
    return {
        accountId: input.accountId,
        agentId: input.agentId,
        conversation: input.conversation,
        cursor: input.cursor,
        kind: 'inbound-message',
        message: {
            attachments: [],
            author: {
                id: 'tavern:user',
                name: 'Tavern',
            },
            id: input.message.id,
            metadata: input.message.metadata,
            nonce: input.message.nonce,
            parentMessageId: input.message.parentMessageId,
            senderId: 'tavern:user',
            senderName: 'Tavern',
            sequence: input.sequence,
            text: input.message.content,
            threadRootId: input.message.threadRootId ?? input.message.id,
            timestamp: input.sentAt,
        },
        requestId: input.requestId,
        sessionKey: input.sessionKey,
        turnId: input.runId,
    };
}

function nextSequence(chatId: string, db: Database): number {
    const row = db
        .prepare(
            'SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM tavern_channel_messages WHERE chat_id = $chatId'
        )
        .get(namedParams({ chatId })) as { sequence: number };

    return row.sequence;
}

function nextMessageCursor(db: Database): number {
    const row = db
        .prepare(
            `SELECT COALESCE(MAX(cursor), 0) + 1 AS cursor
             FROM (
               SELECT cursor FROM tavern_channel_messages
               UNION ALL
               SELECT cursor FROM tavern_channel_events
             )`
        )
        .get() as { cursor: number };

    return row.cursor;
}

function insertAcceptedMessageEvent(
    input: {
        acceptedAt: string;
        cursor: number;
        input: PersistInboundMessageInput;
        runId: string;
        sequence: number;
    },
    db: Database
): PersistedRuntimeEvent {
    const event: AgentRuntimeEvent = {
        agentId: input.input.agentId,
        chatId: input.input.chatId,
        message: {
            id: input.input.message.id,
            nonce: input.input.message.nonce,
            parentMessageId:
                input.input.message.parentMessageId ?? input.input.conversation.parentId ?? null,
            senderId: 'tavern:user',
            senderName: 'Tavern',
            sequence: input.sequence,
            text: input.input.message.content,
            threadRootId:
                input.input.message.threadRootId ??
                input.input.conversation.threadRootId ??
                input.input.message.id,
            timestamp: input.input.sentAt,
        },
        runId: input.runId,
        sessionKey: input.input.sessionKey,
        timestamp: input.acceptedAt,
        type: 'chat.messageAccepted',
    };

    return insertRuntimeEvent(
        {
            deliveryId: `tavern-message:${input.input.message.id}`,
            event,
        },
        db,
        input.cursor
    );
}

function insertRuntimeEvent(
    input: PersistRuntimeEventInput,
    db: Database,
    cursor?: number
): PersistedRuntimeEvent {
    const turn = 'turn' in input.event ? input.event.turn : null;
    const row = db
        .prepare(
            `INSERT INTO tavern_channel_events (
              cursor, event_type, chat_id, session_key, run_id, delivery_id, event_json, created_at
            ) VALUES (
              $cursor, $eventType, $chatId, $sessionKey, $runId, $deliveryId, $eventJson, $createdAt
            )
            RETURNING cursor`
        )
        .get(
            namedParams({
                chatId: getEventChatId(input.event),
                createdAt: input.event.timestamp,
                cursor: cursor ?? null,
                deliveryId: input.deliveryId ?? null,
                eventJson: JSON.stringify(input.event),
                eventType: input.event.type,
                runId: turn?.runId ?? ('runId' in input.event ? input.event.runId : null),
                sessionKey: getEventSessionKey(input.event),
            })
        ) as { cursor: number };

    return {
        cursor: row.cursor,
        event: input.event,
    };
}

function getEventChatId(event: AgentRuntimeEvent): string {
    if ('turn' in event) {
        return event.turn.chatId;
    }
    if ('chatId' in event) {
        return event.chatId;
    }
    return 'runtime';
}

function getEventSessionKey(event: AgentRuntimeEvent): string | null {
    if ('turn' in event) {
        return event.turn.sessionKey;
    }
    if (event.type === 'session.updated') {
        return event.session.key;
    }
    if (event.type === 'session.invalidated') {
        return event.sessionKey;
    }
    if ('sessionKey' in event) {
        return event.sessionKey ?? null;
    }
    return null;
}
