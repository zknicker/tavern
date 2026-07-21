import { expect, test } from 'bun:test';
import { buildChatReadViewKey } from './use-chat-mark-read.ts';

test('only a loaded, visible transcript produces a read-receipt key', () => {
    const input = {
        chatId: 'chat-1',
        enabled: true,
        historyLoaded: true,
        totalMessages: 4,
    };

    expect(buildChatReadViewKey(input)).toBe('chat-1:4');
    expect(buildChatReadViewKey({ ...input, enabled: false })).toBeNull();
    expect(buildChatReadViewKey({ ...input, historyLoaded: false })).toBeNull();
});
