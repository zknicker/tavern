import { expect, test } from 'bun:test';
import {
    addChatTimelineMessage,
    emptyChatTimelineLocalMessagesState,
    moveChatTimelineMessages,
    removeChatTimelineMessages,
    selectChatTimelineMessages,
    setChatTimelineMessageSession,
} from './chat-timeline-local-messages.ts';

const firstMessage = {
    content: 'First',
    id: 'local-1',
    timestamp: '2026-04-20T18:15:00.000Z',
};

const secondMessage = {
    content: 'Second',
    id: 'local-2',
    timestamp: '2026-04-20T18:16:00.000Z',
};

test('stores local timeline messages by id and selects them in chat order', () => {
    const state = addChatTimelineMessage(
        addChatTimelineMessage(emptyChatTimelineLocalMessagesState, {
            ...firstMessage,
            chatId: 'chat-1',
        }),
        {
            ...secondMessage,
            chatId: 'chat-1',
        }
    );

    expect(state.idsByChatId).toEqual({
        'chat-1': ['local-1', 'local-2'],
    });
    expect(Object.keys(state.messagesById).sort()).toEqual(['local-1', 'local-2']);
    expect(selectChatTimelineMessages(state, 'chat-1')).toEqual([firstMessage, secondMessage]);
});

test('replaces a local timeline message without duplicating the id', () => {
    const state = addChatTimelineMessage(
        addChatTimelineMessage(emptyChatTimelineLocalMessagesState, {
            ...firstMessage,
            chatId: 'chat-1',
        }),
        {
            ...firstMessage,
            chatId: 'chat-1',
            content: 'Edited',
        }
    );

    expect(state.idsByChatId['chat-1']).toEqual(['local-1']);
    expect(selectChatTimelineMessages(state, 'chat-1')).toEqual([
        {
            ...firstMessage,
            content: 'Edited',
        },
    ]);
});

test('moves draft timeline messages to a real chat without duplicating existing ids', () => {
    const withDraftMessages = addChatTimelineMessage(
        addChatTimelineMessage(emptyChatTimelineLocalMessagesState, {
            ...firstMessage,
            chatId: 'draft:new',
        }),
        {
            ...secondMessage,
            chatId: 'draft:new',
        }
    );
    const withExistingTarget = addChatTimelineMessage(withDraftMessages, {
        ...firstMessage,
        chatId: 'chat-1',
    });

    const state = moveChatTimelineMessages(withExistingTarget, {
        fromChatId: 'draft:new',
        toChatId: 'chat-1',
    });

    expect(state.idsByChatId).toEqual({
        'chat-1': ['local-1', 'local-2'],
    });
    expect(selectChatTimelineMessages(state, 'chat-1')).toEqual([firstMessage, secondMessage]);
});

test('sets a local timeline message session only for messages in that chat', () => {
    const state = addChatTimelineMessage(emptyChatTimelineLocalMessagesState, {
        ...firstMessage,
        chatId: 'chat-1',
    });

    const ignored = setChatTimelineMessageSession(state, {
        chatId: 'chat-2',
        messageId: 'local-1',
        sessionKey: 'session-ignored',
    });
    const accepted = setChatTimelineMessageSession(ignored, {
        chatId: 'chat-1',
        messageId: 'local-1',
        sessionKey: 'session-1',
    });

    expect(ignored).toBe(state);
    expect(selectChatTimelineMessages(accepted, 'chat-1')).toEqual([
        {
            ...firstMessage,
            sessionKey: 'session-1',
        },
    ]);
});

test('removes confirmed local timeline messages from ids and records', () => {
    const state = addChatTimelineMessage(
        addChatTimelineMessage(emptyChatTimelineLocalMessagesState, {
            ...firstMessage,
            chatId: 'chat-1',
        }),
        {
            ...secondMessage,
            chatId: 'chat-1',
        }
    );

    const updated = removeChatTimelineMessages(state, {
        chatId: 'chat-1',
        messageIds: ['local-1'],
    });

    expect(updated.idsByChatId).toEqual({
        'chat-1': ['local-2'],
    });
    expect(updated.messagesById).toEqual({
        'local-2': secondMessage,
    });
});
