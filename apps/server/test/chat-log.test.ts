import { expect, test } from 'bun:test';
import { resolveBeforeSequence } from '../src/chat/log.ts';

test('chat log without a cursor reads the latest turn-aligned page', () => {
    expect(resolveBeforeSequence(undefined)).toBeUndefined();
});

test('chat log object cursor carries the before-sequence bound', () => {
    expect(resolveBeforeSequence({ beforeSequence: 41 })).toBe(41);
});

test('chat log numeric cursor is a before-sequence bound', () => {
    expect(resolveBeforeSequence(7)).toBe(7);
});
