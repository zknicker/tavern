import { expect, test } from 'bun:test';
import { createChatEventHandlers } from './use-chat-events.ts';

test('chat updates refresh agent-scoped chat lists', async () => {
    const invalidatedQueries: string[] = [];
    const handlers = createChatEventHandlers({
        agent: {
            chats: {
                list: {
                    invalidate: async () => invalidatedQueries.push('agent.chats.list'),
                },
            },
        },
        chat: {
            get: {
                invalidate: async () => invalidatedQueries.push('chat.get'),
            },
            list: {
                invalidate: async () => invalidatedQueries.push('chat.list'),
            },
            listArchived: {
                invalidate: async () => invalidatedQueries.push('chat.listArchived'),
            },
        },
    } as never);

    handlers.onChatUpdate({ chatId: 'chat-1' });
    await Promise.resolve();

    expect(invalidatedQueries).toEqual([
        'agent.chats.list',
        'chat.list',
        'chat.listArchived',
        'chat.get',
    ]);
});
