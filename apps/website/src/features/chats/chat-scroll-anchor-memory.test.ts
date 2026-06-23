import { expect, test } from 'bun:test';
import {
    clearChatScrollAnchorsForTests,
    readChatScrollAnchor,
    writeChatScrollAnchor,
} from './chat-scroll-anchor-memory.ts';

test('chat scroll anchor memory stores anchors per chat', () => {
    clearChatScrollAnchorsForTests();

    writeChatScrollAnchor('chat-one', { atBottom: false, offsetPx: 32, rowId: 'row-one' });
    writeChatScrollAnchor('chat-two', { atBottom: true });

    expect(readChatScrollAnchor('chat-one')).toEqual({
        atBottom: false,
        offsetPx: 32,
        rowId: 'row-one',
    });
    expect(readChatScrollAnchor('chat-two')).toEqual({ atBottom: true });
});

test('chat scroll anchor memory can clear one chat without touching another', () => {
    clearChatScrollAnchorsForTests();

    writeChatScrollAnchor('chat-one', { atBottom: false, offsetPx: 16, rowId: 'row-one' });
    writeChatScrollAnchor('chat-two', { atBottom: false, offsetPx: 24, rowId: 'row-two' });
    writeChatScrollAnchor('chat-one', null);

    expect(readChatScrollAnchor('chat-one')).toBeNull();
    expect(readChatScrollAnchor('chat-two')).toEqual({
        atBottom: false,
        offsetPx: 24,
        rowId: 'row-two',
    });
});
