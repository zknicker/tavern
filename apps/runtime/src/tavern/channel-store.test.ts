import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    listPendingTavernInboundMessages,
    listTavernActiveChannelStatuses,
    listTavernRuntimeEvents,
    markTavernChannelRead,
    markTavernInboundMessageAccepted,
    persistTavernInboundMessage,
    persistTavernRuntimeEvent,
} from './channel-store';

describe('Tavern channel store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('persists accepted messages with per-chat sequences and idempotent nonces', () => {
        const first = persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });
        const replay = persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });
        const second = persistMessage({ id: 'msg-2', nonce: 'nonce-2', text: 'again' });

        expect(replay).toMatchObject({
            cursor: first.cursor,
            messageId: first.messageId,
            runId: first.runId,
            sequence: first.sequence,
        });
        expect(first.sequence).toBe(1);
        expect(second.sequence).toBe(2);
        expect(second.cursor).toBeGreaterThan(first.cursor);
    });

    it('rejects nonce reuse for a different message body', () => {
        persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });

        expect(() => persistMessage({ id: 'msg-2', nonce: 'nonce-1', text: 'different' })).toThrow(
            'already used'
        );
    });

    it('keeps pending messages available until the plugin accepts them', () => {
        const accepted = persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });

        expect(listPendingTavernInboundMessages()).toHaveLength(1);
        markTavernInboundMessageAccepted(accepted.frame.requestId, accepted.acceptedAt);
        expect(listPendingTavernInboundMessages()).toHaveLength(0);
    });

    it('persists accepted message events before the plugin accepts the turn', () => {
        const accepted = persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });

        expect(listTavernRuntimeEvents({ afterCursor: 0 })).toEqual([
            {
                cursor: accepted.cursor,
                event: {
                    agentId: 'agent-1',
                    chatId: 'chat-1',
                    message: {
                        id: 'msg-1',
                        nonce: 'nonce-1',
                        parentMessageId: null,
                        senderId: 'tavern:user',
                        senderName: 'Tavern',
                        sequence: 1,
                        text: 'hello',
                        threadRootId: 'msg-1',
                        timestamp: '2026-05-16T12:00:00.000Z',
                    },
                    runId: accepted.runId,
                    sessionKey: 'session-1',
                    timestamp: accepted.acceptedAt,
                    type: 'chat.messageAccepted',
                },
            },
        ]);
    });

    it('persists runtime events for replay and suppresses duplicate delivery ids', () => {
        const event = {
            text: 'reply',
            timestamp: '2026-05-16T12:00:00.000Z',
            turn: {
                agentId: 'agent-1',
                chatId: 'chat-1',
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-16T12:00:00.000Z',
            },
            type: 'turn.replyUpdated' as const,
        };

        const first = persistTavernRuntimeEvent({ deliveryId: 'delivery-1', event });
        const replay = persistTavernRuntimeEvent({ deliveryId: 'delivery-1', event });

        expect(replay.cursor).toBe(first.cursor);
        expect(listTavernRuntimeEvents({ afterCursor: 0 })).toEqual([
            {
                cursor: first.cursor,
                event,
            },
        ]);
        expect(listTavernRuntimeEvents({ afterCursor: first.cursor })).toEqual([]);
    });

    it('reconstructs active turn status from durable events', () => {
        const turn = {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-16T12:00:00.000Z',
        };

        persistTavernRuntimeEvent({
            deliveryId: 'started-1',
            event: {
                timestamp: '2026-05-16T12:00:01.000Z',
                turn,
                type: 'turn.started',
            },
        });

        expect(listTavernActiveChannelStatuses()).toEqual([
            {
                activeReply: {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                    text: '',
                },
                chatId: 'chat-1',
            },
        ]);

        persistTavernRuntimeEvent({
            deliveryId: 'completed-1',
            event: {
                timestamp: '2026-05-16T12:00:02.000Z',
                turn,
                type: 'turn.completed',
            },
        });

        expect(listTavernActiveChannelStatuses()).toEqual([]);
    });

    it('reconstructs active turn progress from durable events', () => {
        const turn = {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-16T12:00:00.000Z',
        };

        persistTavernRuntimeEvent({
            deliveryId: 'progress-1',
            event: {
                step: {
                    detail: 'Searching docs',
                    id: 'tool:web',
                    kind: 'tool',
                    label: 'Using web search',
                    status: 'active',
                },
                timestamp: '2026-05-16T12:00:03.000Z',
                turn,
                type: 'turn.progress',
            },
        });

        expect(listTavernActiveChannelStatuses()).toEqual([
            {
                activeReply: {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                    text: '',
                },
                activeReplyProgressStartedAt: '2026-05-16T12:00:03.000Z',
                activeReplySteps: [
                    {
                        detail: 'Searching docs',
                        id: 'tool:web',
                        kind: 'tool',
                        label: 'Using web search',
                        status: 'active',
                    },
                ],
                chatId: 'chat-1',
            },
        ]);
    });

    it('reconstructs active turn status from accepted inbound messages', () => {
        const accepted = persistMessage({ id: 'msg-1', nonce: 'nonce-1', text: 'hello' });

        expect(listTavernActiveChannelStatuses()).toEqual([]);

        markTavernInboundMessageAccepted(accepted.frame.requestId, accepted.acceptedAt);

        expect(listTavernActiveChannelStatuses()).toEqual([
            {
                activeReply: {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: accepted.runId,
                    sessionKey: 'session-1',
                    startedAt: accepted.acceptedAt,
                    text: '',
                },
                chatId: 'chat-1',
            },
        ]);

        persistTavernRuntimeEvent({
            deliveryId: 'completed-1',
            event: {
                timestamp: '2026-05-16T12:00:02.000Z',
                turn: {
                    agentId: 'agent-1',
                    chatId: 'chat-1',
                    runId: accepted.runId,
                    sessionKey: 'session-1',
                    startedAt: accepted.acceptedAt,
                },
                type: 'turn.completed',
            },
        });

        expect(listTavernActiveChannelStatuses()).toEqual([]);
    });

    it('persists monotonic read pointers as recoverable events', () => {
        const first = markTavernChannelRead({
            agentId: 'agent-1',
            chatId: 'chat-1',
            lastReadSequence: 2,
            readAt: '2026-05-16T12:01:00.000Z',
            readerId: 'tavern:user',
            sessionKey: 'session-1',
        });
        const stale = markTavernChannelRead({
            agentId: 'agent-1',
            chatId: 'chat-1',
            lastReadSequence: 1,
            readAt: '2026-05-16T12:02:00.000Z',
            readerId: 'tavern:user',
            sessionKey: 'session-1',
        });
        const second = markTavernChannelRead({
            agentId: 'agent-1',
            chatId: 'chat-1',
            lastReadSequence: 3,
            readAt: '2026-05-16T12:03:00.000Z',
            readerId: 'tavern:user',
            sessionKey: 'session-1',
        });

        expect(stale).toBeNull();
        expect(first?.event).toMatchObject({
            chatId: 'chat-1',
            lastReadSequence: 2,
            readerId: 'tavern:user',
            type: 'chat.read',
        });
        expect(second?.event).toMatchObject({
            lastReadSequence: 3,
            type: 'chat.read',
        });
        expect(listTavernRuntimeEvents({ afterCursor: first?.cursor ?? 0 })).toEqual([second]);
    });
});

function persistMessage(input: { id: string; nonce: string; text: string }) {
    return persistTavernInboundMessage({
        accountId: 'default',
        agentId: 'agent-1',
        chatId: 'chat-1',
        conversation: {
            id: 'chat-1',
            kind: 'channel',
            label: 'General',
        },
        message: {
            content: input.text,
            id: input.id,
            metadata: {},
            nonce: input.nonce,
        },
        requestId: `request-${input.id}`,
        sentAt: '2026-05-16T12:00:00.000Z',
        sessionKey: 'session-1',
    });
}
