import { expect, test } from 'bun:test';
import {
    type ChatSendMutationUtils,
    createChatSendMutationHandlers,
} from '../../../hooks/chats/chat-send-mutation.ts';

test('thread sends do not add optimistic messages or turns to the parent timeline', async () => {
    const timelineCalls: string[] = [];
    const mutation = createChatSendMutationHandlers(createMutationUtils(timelineCalls));
    const input = {
        agentId: 'agent-1',
        chatId: 'parent-chat',
        clientMessageId: 'msg_reply',
        content: 'thread reply',
        thread: { anchorMessageId: 'msg_anchor' },
    };
    const context = await mutation.onMutate(input);

    expect(context).toEqual({
        optimisticRunIds: [],
        timelineChatId: null,
        timelineMessageId: 'msg_reply',
    });
    expect(timelineCalls).toEqual([]);

    await mutation.onSuccess(
        {
            acceptedAt: '2026-07-21T16:00:00.000Z',
            chatId: 'parent-chat',
            threadChatId: 'cht_thr_anchor',
            turns: [{ agentId: 'agent-1', runId: 'run_reply_agent-1' }],
        },
        input,
        context
    );

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
            setSession: () => timelineCalls.push('message:set-session'),
        },
        timelineTurn: {
            clear: () => timelineCalls.push('turn:clear'),
            start: () => timelineCalls.push('turn:start'),
        },
    };
}
