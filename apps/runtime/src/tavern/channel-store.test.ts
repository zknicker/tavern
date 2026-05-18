import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    listPendingTavernInboundMessages,
    markTavernInboundMessageAccepted,
    persistTavernInboundMessage,
} from './channel-store';
import { createChat, createDelivery, createMessage, updateActivity } from './chat-api';
import { listTavernRuntimeEvents } from './runtime-event-replay';

describe('Tavern channel store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('stores only one outbox entry for idempotent durable messages', () => {
        const first = persistMessage({ id: 'msg_1', nonce: 'nonce-1', text: 'hello' });
        const replay = persistMessage({ id: 'msg_1', nonce: 'nonce-1', text: 'hello' });
        const nonceReplay = persistMessage({ id: 'msg_retry', nonce: 'nonce-1', text: 'hello' });
        const second = persistMessage({ id: 'msg_2', nonce: 'nonce-2', text: 'again' });

        expect(replay).toMatchObject({
            cursor: first.cursor,
            messageId: first.messageId,
            runId: first.runId,
            sequence: first.sequence,
        });
        expect(nonceReplay).toMatchObject({
            cursor: first.cursor,
            messageId: first.messageId,
            runId: first.runId,
            sequence: first.sequence,
        });
        expect(first.sequence).toBe(1);
        expect(second.sequence).toBe(2);
        expect(second.cursor).toBeGreaterThan(first.cursor);
    });

    it('rejects nonce reuse for a different durable message shape', () => {
        persistMessage({ id: 'msg_1', nonce: 'nonce-1', text: 'hello' });

        expect(() => persistMessage({ id: 'msg_2', nonce: 'nonce-1', text: 'different' })).toThrow(
            'already used'
        );
    });

    it('keeps pending messages available until the plugin accepts them', () => {
        const accepted = persistMessage({ id: 'msg_1', nonce: 'nonce-1', text: 'hello' });

        expect(listPendingTavernInboundMessages()).toHaveLength(1);
        markTavernInboundMessageAccepted(accepted.frame.requestId, accepted.acceptedAt);
        expect(listPendingTavernInboundMessages()).toHaveLength(0);
    });

    it('maps durable chat events into runtime event replay', () => {
        createChat({
            id: 'cht_1',
            metadata: {
                runtime: {
                    agentId: 'agt_1',
                    sessionKey: 'session-1',
                },
            },
        });
        createMessage('cht_1', {
            author_id: 'usr_tavern',
            id: 'msg_1',
            metadata: {
                runtime: {
                    agentId: 'agt_1',
                    sessionKey: 'session-1',
                },
            },
            nonce: 'nonce-1',
            parts: [
                {
                    content: 'hello',
                    kind: 'text',
                },
            ],
            role: 'user',
        });

        expect(listTavernRuntimeEvents({ afterCursor: 0 })).toMatchObject([
            {
                event: {
                    agentId: 'agt_1',
                    chatId: 'cht_1',
                    message: {
                        id: 'msg_1',
                        nonce: 'nonce-1',
                        parentMessageId: null,
                        senderId: 'usr_tavern',
                        senderName: 'usr_tavern',
                        sequence: 1,
                        text: 'hello',
                        threadRootId: 'msg_1',
                    },
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    type: 'chat.messageAccepted',
                },
            },
        ]);
    });

    it('maps durable activity events into runtime turn replay', () => {
        createChat({ id: 'cht_1' });
        updateActivity('cht_1', {
            agent_id: 'agt_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            run_id: 'run_1',
            status: 'running',
        });
        updateActivity('cht_1', {
            agent_id: 'agt_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            run_id: 'run_1',
            status: 'running',
            steps: [
                {
                    completed_at: null,
                    id: 'tool-1',
                    kind: 'command',
                    label: 'Using sleep',
                    metadata: {
                        detail: 'sleep 1',
                    },
                    started_at: '2026-05-16T12:00:01.000Z',
                    status: 'running',
                },
            ],
            summary: 'Working on it.',
        });
        updateActivity('cht_1', {
            agent_id: 'agt_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            run_id: 'run_1',
            status: 'completed',
            summary: 'Working on it.',
        });

        expect(listTavernRuntimeEvents({ afterCursor: 0 }).map((entry) => entry.event)).toEqual([
            {
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.started',
            },
            {
                isThinking: true,
                text: 'Working on it.',
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.replyUpdated',
            },
            {
                step: {
                    detail: 'sleep 1',
                    id: 'tool-1',
                    kind: 'command',
                    label: 'Using sleep',
                    status: 'active',
                },
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.progress',
            },
            {
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.completed',
            },
        ]);
    });

    it('maps durable assistant deliveries into final turn replay events', () => {
        createChat({ id: 'cht_1' });
        createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                author_id: 'agt_1',
                id: 'msg_agent_1',
                metadata: {
                    runtime: {
                        agentId: 'main',
                        runId: 'run_1',
                        sessionKey: 'session-1',
                        startedAt: '2026-05-16T12:00:00.000Z',
                    },
                },
                parts: [
                    {
                        content: 'Done.',
                        kind: 'text',
                    },
                ],
                role: 'assistant',
            },
            turn_id: 'run_1',
        });

        expect(listTavernRuntimeEvents({ afterCursor: 0 }).map((entry) => entry.event)).toEqual([
            {
                isThinking: false,
                replace: true,
                text: 'Done.',
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.replyUpdated',
            },
            {
                timestamp: expect.any(String),
                turn: {
                    agentId: 'main',
                    chatId: 'cht_1',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
                type: 'turn.completed',
            },
        ]);
    });
});

function persistMessage(input: { id: string; nonce: string; text: string }) {
    createChat({ id: 'cht_1' });
    const receipt = createMessage('cht_1', {
        author_id: 'usr_tavern',
        id: input.id,
        metadata: {
            runtime: {
                agentId: 'agt_1',
                sessionKey: 'session-1',
            },
        },
        nonce: input.nonce,
        parts: [
            {
                content: input.text,
                kind: 'text',
            },
        ],
        role: 'user',
    });

    return persistTavernInboundMessage({
        accountId: 'default',
        agentId: 'agt_1',
        chatId: 'cht_1',
        conversation: {
            id: 'cht_1',
            kind: 'channel',
            label: 'General',
        },
        cursor: receipt.cursor,
        messageId: receipt.message.id,
        requestId: `request-${input.id}`,
        sessionKey: 'session-1',
    });
}
