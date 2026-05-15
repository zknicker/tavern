import { expect, test } from 'vitest';
import {
    getChatComposerLineBreakUpdate,
    shouldInsertChatComposerLineBreak,
    shouldSubmitChatComposerKey,
} from './chat-composer-keyboard.ts';

test('chat composer submits on Enter without modifiers', () => {
    expect(shouldSubmitChatComposerKey({ key: 'Enter' })).toBe(true);
    expect(shouldSubmitChatComposerKey({ key: 'Enter', metaKey: true })).toBe(false);
    expect(shouldSubmitChatComposerKey({ key: 'a' })).toBe(false);
});

test('chat composer keeps IME composition Enter out of submit and line break handling', () => {
    const event = { key: 'Enter', metaKey: true, nativeEvent: { isComposing: true } };

    expect(shouldSubmitChatComposerKey(event)).toBe(false);
    expect(shouldInsertChatComposerLineBreak(event)).toBe(false);
});

test('chat composer inserts a line break for Cmd+Enter', () => {
    expect(shouldInsertChatComposerLineBreak({ key: 'Enter', metaKey: true })).toBe(true);

    expect(
        getChatComposerLineBreakUpdate({
            selectionEnd: 5,
            selectionStart: 5,
            value: 'hello world',
        })
    ).toEqual({
        selection: 6,
        value: 'hello\n world',
    });
});

test('chat composer line break replaces the selected range', () => {
    expect(
        getChatComposerLineBreakUpdate({
            selectionEnd: 5,
            selectionStart: 2,
            value: 'abcdef',
        })
    ).toEqual({
        selection: 3,
        value: 'ab\nf',
    });
});
