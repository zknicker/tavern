import { expect, test } from 'bun:test';
import { createChatTurnEventHandlers } from './chat-turn-events.ts';

function createHandlers(input?: {
    invalidatedQueries?: string[];
    onComplete?: (runId: string) => void;
    onFail?: (value: string) => void;
    onReply?: (value: string) => void;
    onStart?: (runId: string) => void;
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
            get: {
                invalidate: async ({ chatId }: { chatId: string }) =>
                    invalidatedQueries.push(`chat.get:${chatId}`),
            },
            log: {
                list: {
                    invalidate: async () => invalidatedQueries.push('chat.log.list'),
                    patchProgress: ({ chatId, updater }) => {
                        input?.patchedProgress?.push(chatId);
                        updater(undefined);
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => invalidatedQueries.push('session.get'),
            },
            history: {
                get: {
                    invalidate: async () => invalidatedQueries.push('session.history.get'),
                },
            },
            list: {
                invalidate: async () => invalidatedQueries.push('session.list'),
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear.');
            },
            completeTurn: (event) => input?.onComplete?.(event.turn.runId),
            failTurn: (event) => input?.onFail?.(`${event.turn.runId}:${event.error}`),
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

test('turn completion preserves the handoff and invalidates transcript queries', async () => {
    const invalidatedQueries: string[] = [];
    const completedTurns: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onComplete: (runId) => completedTurns.push(runId),
    });

    handlers.onTurnCompleted(turn);
    await Promise.resolve();

    expect(completedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual([
        'agent.activity',
        'chat.get:chat-1',
        'chat.log.list',
        'session.get',
        'session.history.get',
        'session.list',
        'worker.list',
    ]);
});

test('turn start refreshes durable chat activity', async () => {
    const invalidatedQueries: string[] = [];
    const startedTurns: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
        onStart: (runId) => startedTurns.push(runId),
    });

    handlers.onTurnStarted(turn);
    await Promise.resolve();

    expect(startedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual(['agent.activity', 'chat.log.list', 'worker.list']);
});

test('turn progress patches durable chat activity and refreshes live status', async () => {
    const invalidatedQueries: string[] = [];
    const patchedProgress: string[] = [];
    const handlers = createHandlers({
        invalidatedQueries,
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
    expect(invalidatedQueries).toEqual(['agent.activity', 'worker.list']);
});

test('turn reply updates local timeline state and refreshes live status', async () => {
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
    expect(invalidatedQueries).toEqual(['agent.activity', 'worker.list']);
});

test('turn failure marks the local timeline failed and invalidates transcript queries', async () => {
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
    expect(invalidatedQueries).toEqual([
        'agent.activity',
        'chat.get:chat-1',
        'chat.log.list',
        'session.get',
        'session.history.get',
        'session.list',
        'worker.list',
    ]);
});
