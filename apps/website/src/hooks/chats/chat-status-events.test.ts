import { expect, test } from 'bun:test';
import { createChatStatusEventHandlers } from './chat-status-events.ts';

test('turn completion preserves the handoff and invalidates transcript queries', async () => {
    const invalidatedQueries: string[] = [];

    const handlers = createChatStatusEventHandlers({
        agent: {
            activity: {
                invalidate: async () => {
                    invalidatedQueries.push('agent.activity');
                },
            },
        },
        chat: {
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
            status: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.status.list');
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => {
                    invalidatedQueries.push('session.get');
                },
            },
            history: {
                get: {
                    invalidate: async () => {
                        invalidatedQueries.push('session.history.get');
                    },
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear while handling completion.');
            },
            failTurn: () => {
                throw new Error('Expected no turn failure while handling completion.');
            },
            startTurn: () => {
                throw new Error('Expected no turn start while handling completion.');
            },
            updateReply: () => {
                throw new Error('Expected no reply update while handling completion.');
            },
            updateTurnProgress: () => {
                throw new Error('Expected no progress update while handling completion.');
            },
        },
        worker: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('worker.list');
                },
            },
        },
    });

    handlers.onTurnCompleted({
        agentId: 'agent-1',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-27T17:20:07.408Z',
    });
    await Promise.resolve();

    expect(invalidatedQueries).toEqual([
        'agent.activity',
        'chat.log.list',
        'chat.status.list',
        'session.get',
        'session.history.get',
        'session.list',
        'worker.list',
    ]);
});

test('turn start keeps the status refresh narrow', async () => {
    const invalidatedQueries: string[] = [];
    const startedTurns: string[] = [];

    const handlers = createChatStatusEventHandlers({
        agent: {
            activity: {
                invalidate: async () => {
                    invalidatedQueries.push('agent.activity');
                },
            },
        },
        chat: {
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
            status: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.status.list');
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => {
                    invalidatedQueries.push('session.get');
                },
            },
            history: {
                get: {
                    invalidate: async () => {
                        invalidatedQueries.push('session.history.get');
                    },
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear while handling start.');
            },
            failTurn: () => {
                throw new Error('Expected no turn failure while handling start.');
            },
            startTurn: (turn) => {
                startedTurns.push(turn.runId);
            },
            updateReply: () => {
                throw new Error('Expected no reply update while handling start.');
            },
            updateTurnProgress: () => {
                throw new Error('Expected no progress update while handling start.');
            },
        },
        worker: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('worker.list');
                },
            },
        },
    });

    handlers.onTurnStarted({
        agentId: 'agent-1',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-27T17:20:07.408Z',
    });
    await Promise.resolve();

    expect(startedTurns).toEqual(['run-1']);
    expect(invalidatedQueries).toEqual(['agent.activity', 'chat.status.list', 'worker.list']);
});

test('turn progress updates local timeline state without invalidating queries', () => {
    const invalidatedQueries: string[] = [];
    const progress: string[] = [];

    const handlers = createChatStatusEventHandlers({
        agent: {
            activity: {
                invalidate: async () => {
                    invalidatedQueries.push('agent.activity');
                },
            },
        },
        chat: {
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
            status: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.status.list');
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => {
                    invalidatedQueries.push('session.get');
                },
            },
            history: {
                get: {
                    invalidate: async () => {
                        invalidatedQueries.push('session.history.get');
                    },
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear while handling progress.');
            },
            failTurn: () => {
                throw new Error('Expected no turn failure while handling progress.');
            },
            startTurn: () => {
                throw new Error('Expected no turn start while handling progress.');
            },
            updateReply: () => {
                throw new Error('Expected no reply update while handling progress.');
            },
            updateTurnProgress: (input) => {
                progress.push(`${input.turn.runId}:${input.step.id}`);
            },
        },
        worker: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('worker.list');
                },
            },
        },
    });

    handlers.onTurnProgress({
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        turn: {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-27T17:20:07.408Z',
        },
    });

    expect(progress).toEqual(['run-1:tool:web']);
    expect(invalidatedQueries).toEqual([]);
});

test('turn reply updates local timeline state without invalidating queries', () => {
    const invalidatedQueries: string[] = [];
    const updates: string[] = [];

    const handlers = createChatStatusEventHandlers({
        agent: {
            activity: {
                invalidate: async () => {
                    invalidatedQueries.push('agent.activity');
                },
            },
        },
        chat: {
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
            status: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.status.list');
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => {
                    invalidatedQueries.push('session.get');
                },
            },
            history: {
                get: {
                    invalidate: async () => {
                        invalidatedQueries.push('session.history.get');
                    },
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear while handling reply updates.');
            },
            failTurn: () => {
                throw new Error('Expected no turn failure while handling reply updates.');
            },
            startTurn: () => {
                throw new Error('Expected no turn start while handling reply updates.');
            },
            updateReply: (update) => {
                updates.push(`${update.turn.runId}:${update.text}`);
            },
            updateTurnProgress: () => {
                throw new Error('Expected no progress update while handling reply updates.');
            },
        },
        worker: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('worker.list');
                },
            },
        },
    });

    handlers.onTurnReplyUpdated({
        isThinking: false,
        text: 'Done',
        turn: {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-27T17:20:07.408Z',
        },
    });

    expect(updates).toEqual(['run-1:Done']);
    expect(invalidatedQueries).toEqual([]);
});

test('turn failure marks the local timeline failed and invalidates transcript queries', async () => {
    const failedTurns: string[] = [];
    const invalidatedQueries: string[] = [];

    const handlers = createChatStatusEventHandlers({
        agent: {
            activity: {
                invalidate: async () => {
                    invalidatedQueries.push('agent.activity');
                },
            },
        },
        chat: {
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
            status: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.status.list');
                    },
                },
            },
        },
        session: {
            get: {
                invalidate: async () => {
                    invalidatedQueries.push('session.get');
                },
            },
            history: {
                get: {
                    invalidate: async () => {
                        invalidatedQueries.push('session.history.get');
                    },
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        timeline: {
            clearTurn: () => {
                throw new Error('Expected no turn clear while handling failure.');
            },
            failTurn: (input) => {
                failedTurns.push(`${input.turn.runId}:${input.error}`);
            },
            startTurn: () => {
                throw new Error('Expected no turn start while handling failure.');
            },
            updateReply: () => {
                throw new Error('Expected no reply update while handling failure.');
            },
            updateTurnProgress: () => {
                throw new Error('Expected no progress update while handling failure.');
            },
        },
        worker: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('worker.list');
                },
            },
        },
    });

    handlers.onTurnFailed({
        error: 'Docker is not running',
        turn: {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-27T17:20:07.408Z',
        },
    });
    await Promise.resolve();

    expect(failedTurns).toEqual(['run-1:Docker is not running']);
    expect(invalidatedQueries).toEqual([
        'agent.activity',
        'chat.log.list',
        'chat.status.list',
        'session.get',
        'session.history.get',
        'session.list',
        'worker.list',
    ]);
});
