import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    listPendingTavernInboundMessages,
    markTavernInboundMessageAccepted,
    persistTavernInboundMessage,
} from './channel-store.ts';
import {
    createChat,
    createDelivery,
    createMessage,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection.ts';

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

    it('includes durable message attachments in inbound frames', () => {
        const persisted = persistMessage({
            attachments: [
                {
                    filename: 'notes.txt',
                    mediaType: 'text/plain',
                    path: '/tmp/notes.txt',
                    sizeBytes: 14,
                    type: 'file',
                },
            ],
            id: 'msg_1',
            nonce: 'nonce-1',
            text: 'see attached',
        });

        expect(persisted.frame.message.attachments).toEqual([
            {
                filename: 'notes.txt',
                mediaType: 'text/plain',
                path: '/tmp/notes.txt',
                sizeBytes: 14,
                type: 'file',
            },
        ]);
    });

    it('maps durable chat events into runtime event projections', () => {
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
            content: 'hello',
            nonce: 'nonce-1',
            role: 'user',
        });

        expect(listProjectedTavernRuntimeEvents({ afterCursor: 0 })).toMatchObject([
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

    it('maps durable activity events into runtime turn projections', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_run_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_run_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            participant_id: 'agt_1',
            status: 'running',
            summary: 'Working on it.',
        });
        upsertResponseActivity('cht_1', 'rsp_run_1', {
            detail: 'sleep 1',
            id: 'act_tool_1',
            kind: 'command',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            started_at: '2026-05-16T12:00:01.000Z',
            status: 'running',
            title: 'Using sleep',
        });
        upsertResponse('cht_1', {
            completed_at: '2026-05-16T12:00:02.000Z',
            id: 'rsp_run_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            participant_id: 'agt_1',
            status: 'completed',
            summary: 'Working on it.',
        });

        expect(
            listProjectedTavernRuntimeEvents({ afterCursor: 0 }).map((entry) => entry.event)
        ).toMatchObject([
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
                    id: 'act_tool_1',
                    kind: 'command',
                    label: 'Using sleep',
                    status: 'active',
                    toolCallId: null,
                    toolName: null,
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

    it('projects terminal activity steps as terminal progress', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            completed_at: '2026-05-16T12:00:02.000Z',
            id: 'rsp_run_1',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            participant_id: 'agt_1',
            status: 'completed',
        });
        upsertResponseActivity('cht_1', 'rsp_run_1', {
            completed_at: '2026-05-16T12:00:02.000Z',
            id: 'act_tool_1',
            kind: 'tool_call',
            metadata: {
                runtime: {
                    agentId: 'main',
                    runId: 'run_1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-16T12:00:00.000Z',
                },
            },
            started_at: '2026-05-16T12:00:01.000Z',
            status: 'completed',
            title: 'Using tool',
        });

        expect(
            listProjectedTavernRuntimeEvents({ afterCursor: 0 }).map((entry) => entry.event)
        ).toMatchObject([
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
            {
                step: {
                    detail: null,
                    id: 'act_tool_1',
                    kind: 'tool',
                    label: 'Using tool',
                    status: 'completed',
                    toolCallId: null,
                    toolName: null,
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
        ]);
    });

    it('maps durable assistant deliveries into terminal turn projection events', () => {
        createChat({ id: 'cht_1' });
        createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                author_id: 'agt_1',
                content: 'Done.',
                id: 'msg_agent_1',
                metadata: {
                    runtime: {
                        agentId: 'main',
                        runId: 'run_1',
                        sessionKey: 'session-1',
                        startedAt: '2026-05-16T12:00:00.000Z',
                    },
                },
                role: 'assistant',
            },
            turn_id: 'run_1',
        });

        expect(
            listProjectedTavernRuntimeEvents({ afterCursor: 0 }).map((entry) => entry.event)
        ).toEqual([
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

function persistMessage(input: {
    attachments?: Record<string, unknown>[];
    id: string;
    nonce: string;
    text: string;
}) {
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
        attachments: input.attachments,
        content: input.text,
        nonce: input.nonce,
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
