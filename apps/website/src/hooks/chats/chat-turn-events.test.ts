import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { createChatTurnEventHandlers } from './chat-turn-events.ts';

function createHandlers(input?: {
    invalidatedQueries?: string[];
    onComplete?: (runId: string) => void;
    onFail?: (value: string) => void;
    onProgress?: (value: string) => void;
    onReply?: (value: string) => void;
    onStart?: (runId: string) => void;
    patchLog?: (updater: (current: ChatLogOutput | undefined) => ChatLogOutput | undefined) => void;
    patchedProgress?: string[];
}) {
    const invalidatedQueries = input?.invalidatedQueries ?? [];

    return createChatTurnEventHandlers({
        agent: {
            activity: {
                invalidate: async () => invalidatedQueries.push('agent.activity'),
            },
        },
        chat: {
            list: {
                invalidate: async () => invalidatedQueries.push('chat.list'),
            },
            log: {
                list: {
                    patchProgress: ({ chatId, updater }) => {
                        input?.patchedProgress?.push(chatId);
                        input?.patchLog ? input.patchLog(updater) : updater(undefined);
                    },
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear.');
            },
            completeTurn: (event) => input?.onComplete?.(event.turn.runId),
            failTurn: (event) => input?.onFail?.(`${event.turn.runId}:${event.error}`),
            patchProgress: (event) =>
                input?.onProgress?.(`${event.turn.runId}:${event.step.id}:${event.timestamp}`),
            startTurn: (turn) => input?.onStart?.(turn.runId),
            updateReply: (update) => input?.onReply?.(`${update.turn.runId}:${update.text}`),
        },
        worker: {
            list: {
                invalidate: async () => invalidatedQueries.push('worker.list'),
            },
        },
    });
}

const turn = {
    agentId: 'agent-1',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'session-1',
    startedAt: '2026-04-27T17:20:07.408Z',
};

test('turn completion preserves the handoff and refreshes live agent status only', async () => {
    const invalidatedQueries: string[] = [];
    const completedTurns: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onComplete: (runId) => completedTurns.push(runId),
    });

    handlers.onTurnCompleted(turn);
    await Promise.resolve();

    expect(completedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual(['agent.activity']);
});

test('duplicate turn completion events do not refetch live status again', async () => {
    const invalidatedQueries: string[] = [];
    const completedTurns: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onComplete: (runId) => completedTurns.push(runId),
    });

    handlers.onTurnCompleted(turn);
    handlers.onTurnCompleted(turn);
    await Promise.resolve();

    expect(completedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual(['agent.activity']);
});

test('turn start refreshes live status without refetching durable chat activity', async () => {
    const invalidatedQueries: string[] = [];
    const startedTurns: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onStart: (runId) => startedTurns.push(runId),
    });

    handlers.onTurnStarted(turn);
    await Promise.resolve();

    expect(startedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual(['agent.activity', 'worker.list', 'chat.list']);
});

test('turn progress patches durable chat activity without refetching live status', async () => {
    const invalidatedQueries: string[] = [];
    const patchedProgress: string[] = [];
    const timelineProgress: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onProgress: (value) => timelineProgress.push(value),
        patchedProgress,
    });

    handlers.onTurnProgress({
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-27T17:20:08.408Z',
        turn,
    });
    await Promise.resolve();

    expect(patchedProgress).toEqual(['chat-1']);
    expect(timelineProgress).toEqual(['run-1:tool:web:2026-04-27T17:20:08.408Z']);
    expect(invalidatedQueries).toEqual([]);
});

test('turn progress applies preamble and normalized tool updates without refetching chat log', async () => {
    const invalidatedQueries: string[] = [];
    const patchedProgress: string[] = [];
    let log: ChatLogOutput | undefined = {
        activeReply: null,
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    };
    const handlers = createHandlers({
        invalidatedQueries,
        patchLog: (updater) => {
            log = updater(log);
        },
        patchedProgress,
    });

    handlers.onTurnProgress({
        step: {
            detail: 'I will inspect the workspace before replying.',
            id: 'assistant-preamble',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-04-27T17:20:08.000Z',
        turn,
    });
    handlers.onTurnProgress({
        step: {
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'active',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-04-27T17:20:09.000Z',
        turn,
    });
    handlers.onTurnProgress({
        step: {
            detail: '# QA kickoff task',
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'completed',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-04-27T17:20:10.000Z',
        turn,
    });
    await Promise.resolve();

    expect(patchedProgress).toEqual(['chat-1', 'chat-1', 'chat-1']);
    expect(log?.rows.map((row) => row.id)).toEqual([
        'act_run-1_assistant-preamble',
        'act_run-1_call_mock_read_123',
    ]);
    expect(log?.rows[1]).toMatchObject({
        completedAt: '2026-04-27T17:20:10.000Z',
        startedAt: '2026-04-27T17:20:09.000Z',
    });
    expect(invalidatedQueries).toEqual([]);
});

test('turn progress preserves clarification prompt data in live chat rows', async () => {
    const patchedProgress: string[] = [];
    let log: ChatLogOutput | undefined = {
        activeReply: null,
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    };
    const handlers = createHandlers({
        patchLog: (updater) => {
            log = updater(log);
        },
        patchedProgress,
    });
    const clarification = {
        choices: ['Los Angeles', 'San Francisco'],
        deadlineAt: '2026-06-12T16:00:00.000Z',
        question: 'Which part of California?',
        requestId: 'clarify_1',
    };

    handlers.onTurnProgress({
        step: {
            clarification,
            detail: clarification.question,
            id: 'act_run-1_clarify_1',
            kind: 'tool',
            label: 'Clarification',
            status: 'active',
            toolName: 'clarify',
        },
        timestamp: '2026-06-12T15:58:00.000Z',
        turn,
    });
    handlers.onTurnProgress({
        step: {
            clarification: {
                ...clarification,
                answer: 'San Francisco',
                disposition: 'answered',
            },
            detail: clarification.question,
            id: 'act_run-1_clarify_1',
            kind: 'tool',
            label: 'Clarification',
            status: 'completed',
            toolName: 'clarify',
        },
        timestamp: '2026-06-12T15:58:04.000Z',
        turn,
    });
    await Promise.resolve();

    expect(patchedProgress).toEqual(['chat-1', 'chat-1']);
    expect(log?.rows[0]).toMatchObject({
        clarification: {
            answer: 'San Francisco',
            choices: ['Los Angeles', 'San Francisco'],
            disposition: 'answered',
            question: 'Which part of California?',
            requestId: 'clarify_1',
        },
        completedAt: '2026-06-12T15:58:04.000Z',
        toolCall: {
            name: 'clarify',
            summaryParts: ['Which part of California?'],
        },
    });
});

test('turn reply updates local timeline state without refetching live status', async () => {
    const invalidatedQueries: string[] = [];
    const updates: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onReply: (value) => updates.push(value),
    });

    handlers.onTurnReplyUpdated({
        isThinking: false,
        text: 'Done',
        turn,
    });
    await Promise.resolve();

    expect(updates).toEqual(['run-1:Done']);
    expect(invalidatedQueries).toEqual([]);
});

test('turn failure marks the local timeline failed and refreshes live agent status only', async () => {
    const failedTurns: string[] = [];
    const invalidatedQueries: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onFail: (value) => failedTurns.push(value),
    });

    handlers.onTurnFailed({
        error: 'Docker is not running',
        turn,
    });
    await Promise.resolve();

    expect(failedTurns).toEqual(['run-1:Docker is not running']);
    expect(invalidatedQueries).toEqual(['agent.activity']);
});
