import { expect, test } from 'bun:test';
import { createChatRunId } from './chat-run-id.ts';
import { createChatSendMutationHandlers } from './chat-send-mutation.ts';

test('useChatSend stores the local user row in app state until the log catches up', async () => {
    const invalidatedQueries: string[] = [];
    const timelineMessages: Array<{
        chatId: string;
        content: string;
        id: string;
        timestamp: string;
    }> = [];
    const acceptedMessages: Array<{
        chatId: string;
        messageId: string;
        sessionKey?: string | null;
    }> = [];
    const startedTurns: Array<{
        agentId: string;
        chatId: string;
        runId: string;
        sessionKey: string;
        startedAt: string;
    }> = [];

    const mutation = createChatSendMutationHandlers({
        chat: {
            get: {
                invalidate: async ({ chatId }) => {
                    invalidatedQueries.push(`chat.get:${chatId}`);
                },
            },
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('chat.list');
                },
            },
            log: {
                list: {
                    invalidate: async () => {
                        invalidatedQueries.push('chat.log.list');
                    },
                },
            },
        },
        timelineMessage: {
            add: (message) => {
                timelineMessages.push(message);
            },
            setSession: (message) => {
                acceptedMessages.push(message);
            },
            remove: () => {
                throw new Error('Expected the local row to stay until logged history replaces it.');
            },
        },
        timelineTurn: {
            clear: () => {
                throw new Error('Expected no pending turn clear on success.');
            },
            start: (turn) => {
                startedTurns.push(turn);
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
    });
    const input = {
        agentId: 'agent-1',
        chatId: 'chat-1',
        clientMessageId: 'msg_1',
        content: 'love to hear it',
    };
    const context = await mutation.onMutate(input);

    expect(timelineMessages).toHaveLength(1);
    expect(timelineMessages[0]).toMatchObject({
        chatId: 'chat-1',
        content: 'love to hear it',
    });
    expect(timelineMessages[0]?.id).toBe('msg_1');
    expect(context?.timelineMessageId).toBe(timelineMessages[0]?.id);

    const result = {
        acceptedAt: '2026-04-20T18:15:00.000Z',
        chatId: 'chat-1',
        turns: [
            {
                agentId: 'agent-1',
                runId: 'run_1',
            },
        ],
        status: 'accepted' as const,
    };

    await mutation.onSuccess(result, input, context);

    expect(invalidatedQueries).toEqual([
        'chat.get:chat-1',
        'chat.list',
        'chat.log.list',
        'session.list',
    ]);
    expect(acceptedMessages).toEqual([
        {
            chatId: 'chat-1',
            messageId: context?.timelineMessageId,
            sessionKey: 'run_1',
        },
    ]);
    expect(startedTurns).toEqual([
        {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run_1',
            sessionKey: '',
            startedAt: timelineMessages[0]?.timestamp,
        },
        {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run_1',
            sessionKey: 'run_1',
            startedAt: '2026-04-20T18:15:00.000Z',
        },
    ]);
});

test('useChatSend does not start a turn for human-only channel messages', async () => {
    const startedTurns: unknown[] = [];
    const acceptedMessages: unknown[] = [];
    const mutation = createChatSendMutationHandlers({
        chat: {
            get: {
                invalidate: async () => undefined,
            },
            list: {
                invalidate: async () => undefined,
            },
            log: {
                list: {
                    invalidate: async () => undefined,
                },
            },
        },
        timelineMessage: {
            add: () => undefined,
            setSession: (message) => {
                acceptedMessages.push(message);
            },
            remove: () => undefined,
        },
        timelineTurn: {
            clear: () => undefined,
            start: (turn) => {
                startedTurns.push(turn);
            },
        },
        session: {
            get: {
                invalidate: async () => undefined,
            },
            history: {
                get: {
                    invalidate: async () => undefined,
                },
            },
            list: {
                invalidate: async () => undefined,
            },
        },
    });
    const input = {
        chatId: 'chat-1',
        clientMessageId: 'msg_human',
        content: 'human-only note',
    };
    const context = await mutation.onMutate(input);

    await mutation.onSuccess(
        {
            acceptedAt: '2026-04-20T18:15:00.000Z',
            chatId: 'chat-1',
            turns: [],
        },
        input,
        context
    );

    expect(startedTurns).toEqual([]);
    expect(acceptedMessages).toEqual([]);
});

test('useChatSend starts optimistic turns for mentioned channel agents', async () => {
    const startedTurns: Array<{ agentId: string }> = [];
    const mutation = createChatSendMutationHandlers({
        chat: {
            get: {
                invalidate: async () => undefined,
            },
            list: {
                invalidate: async () => undefined,
            },
            log: {
                list: {
                    invalidate: async () => undefined,
                },
            },
        },
        timelineMessage: {
            add: () => undefined,
            setSession: () => undefined,
            remove: () => undefined,
        },
        timelineTurn: {
            clear: () => undefined,
            start: (turn) => {
                startedTurns.push(turn);
            },
        },
        session: {
            get: {
                invalidate: async () => undefined,
            },
            history: {
                get: {
                    invalidate: async () => undefined,
                },
            },
            list: {
                invalidate: async () => undefined,
            },
        },
    });

    await mutation.onMutate({
        chatId: 'chat-1',
        clientMessageId: 'msg_mentions',
        content: '@Planner @Critic plan',
        metadata: {
            tavern: {
                mentions: [
                    {
                        id: 'agent-planner',
                        kind: 'agent',
                    },
                    {
                        id: 'agent-critic',
                        kind: 'agent',
                    },
                ],
            },
        },
    });

    expect(startedTurns.map((turn) => turn.agentId)).toEqual(['agent-planner', 'agent-critic']);
});

test('useChatSend removes the local user row if the send fails', async () => {
    const removedMessages: Array<{ chatId: string; messageId: string }> = [];
    const clearedTurns: Array<{ chatId: string; runId?: string }> = [];

    const mutation = createChatSendMutationHandlers({
        chat: {
            get: {
                invalidate: async () => undefined,
            },
            list: {
                invalidate: async () => undefined,
            },
            log: {
                list: {
                    invalidate: async () => undefined,
                },
            },
        },
        timelineMessage: {
            add: () => undefined,
            setSession: () => undefined,
            remove: (message) => {
                removedMessages.push(message);
            },
        },
        timelineTurn: {
            clear: (turn) => {
                clearedTurns.push(turn);
            },
            start: () => undefined,
        },
        session: {
            get: {
                invalidate: async () => undefined,
            },
            history: {
                get: {
                    invalidate: async () => undefined,
                },
            },
            list: {
                invalidate: async () => undefined,
            },
        },
    });
    const input = {
        agentId: 'agent-1',
        chatId: 'chat-1',
        content: 'love to hear it',
    };
    const context = await mutation.onMutate(input);

    if (!context) {
        throw new Error('Expected mutation context.');
    }

    mutation.onError(new Error('send failed'), input, context);

    expect(removedMessages).toEqual([
        {
            chatId: 'chat-1',
            messageId: context?.timelineMessageId,
        },
    ]);
    expect(clearedTurns).toEqual([
        {
            chatId: 'chat-1',
            runId: createChatRunId(context.timelineMessageId),
        },
    ]);
});
