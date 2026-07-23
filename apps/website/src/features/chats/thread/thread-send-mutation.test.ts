import { expect, test } from 'bun:test';
import {
    type ChatSendMutationUtils,
    createChatSendMutationHandlers,
} from '../../../hooks/chats/chat-send-mutation.ts';

test('thread sends do not add an optimistic message to the parent timeline', async () => {
    const timelineCalls: string[] = [];
    const mutation = createChatSendMutationHandlers(createMutationUtils(timelineCalls));
    const input = {
        chatId: 'parent-chat',
        clientMessageId: 'msg_reply',
        content: 'thread reply',
        thread: { anchorMessageId: 'msg_anchor' },
    };
    const context = await mutation.onMutate(input);

    expect(context).toEqual({
        timelineChatId: null,
        timelineMessageId: 'msg_reply',
    });
    expect(timelineCalls).toEqual([]);

    await mutation.onSuccess({ chatId: 'parent-chat' });

    expect(timelineCalls).toEqual([]);
});

function createMutationUtils(timelineCalls: string[]): ChatSendMutationUtils {
    const invalidate = async () => undefined;

    return {
        chat: {
            get: { invalidate },
            list: { invalidate },
            log: { list: { invalidate } },
        },
        session: {
            get: { invalidate },
            history: { get: { invalidate } },
            list: { invalidate },
        },
        timelineMessage: {
            add: () => timelineCalls.push('message:add'),
            remove: () => timelineCalls.push('message:remove'),
        },
    };
}
