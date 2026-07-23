import { expect, test } from 'bun:test';
import { createChatSendMutationHandlers } from './chat-send-mutation.ts';

function buildMutation(input: {
    onAdd?: (message: { chatId: string; content: string; id: string; timestamp: string }) => void;
    onRemove?: (message: { chatId: string; messageId: string }) => void;
}) {
    const invalidatedQueries: string[] = [];

    return {
        invalidatedQueries,
        mutation: createChatSendMutationHandlers({
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
            timelineMessage: {
                add: (message) => input.onAdd?.(message),
                remove: (message) => input.onRemove?.(message),
            },
        }),
    };
}

test('useChatSend stores the local user row and invalidates chat queries on success', async () => {
    const timelineMessages: Array<{ chatId: string; content: string; id: string }> = [];
    const { invalidatedQueries, mutation } = buildMutation({
        onAdd: (message) => timelineMessages.push(message),
        onRemove: () => {
            throw new Error('Expected the local row to stay until logged history replaces it.');
        },
    });

    const input = { chatId: 'chat-1', clientMessageId: 'msg_1', content: 'love to hear it' };
    const context = await mutation.onMutate(input);

    expect(timelineMessages).toHaveLength(1);
    expect(timelineMessages[0]).toMatchObject({ chatId: 'chat-1', content: 'love to hear it' });
    expect(context?.timelineMessageId).toBe('msg_1');

    await mutation.onSuccess({ chatId: 'chat-1' });

    expect(invalidatedQueries).toEqual([
        'chat.get:chat-1',
        'chat.list',
        'chat.log.list',
        'session.list',
    ]);
});

test('useChatSend removes the local user row if the send fails', async () => {
    const removedMessages: Array<{ chatId: string; messageId: string }> = [];
    const { mutation } = buildMutation({
        onRemove: (message) => removedMessages.push(message),
    });

    const input = { chatId: 'chat-1', content: 'love to hear it' };
    const context = await mutation.onMutate(input);

    if (!context) {
        throw new Error('Expected mutation context.');
    }

    mutation.onError(new Error('send failed'), input, context);

    expect(removedMessages).toEqual([{ chatId: 'chat-1', messageId: context.timelineMessageId }]);
});

test('useChatSend skips the optimistic row for thread replies', async () => {
    const timelineMessages: unknown[] = [];
    const { mutation } = buildMutation({
        onAdd: (message) => timelineMessages.push(message),
    });

    const context = await mutation.onMutate({
        chatId: 'chat-1',
        content: 'a reply',
        thread: { anchorMessageId: 'msg_anchor' },
    });

    expect(timelineMessages).toEqual([]);
    expect(context?.timelineChatId).toBeNull();
});
