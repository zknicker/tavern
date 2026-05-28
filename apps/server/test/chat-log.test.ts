import { expect, test } from 'bun:test';
import { resolveChatLogOffset } from '../src/chat/log.ts';

test('backward infinite query without a cursor loads the first chat log page', () => {
    expect(
        resolveChatLogOffset({
            direction: 'backward',
            limit: 100,
            total: 140,
        })
    ).toBe(0);
});

test('chat log offset defaults to the latest page', () => {
    expect(
        resolveChatLogOffset({
            limit: 100,
            total: 140,
        })
    ).toBe(40);
});

test('chat log cursor remains an absolute row offset when present', () => {
    expect(
        resolveChatLogOffset({
            cursor: 20,
            direction: 'backward',
            limit: 100,
            total: 140,
        })
    ).toBe(20);
});

test('chat log object cursor can represent offset zero', () => {
    expect(
        resolveChatLogOffset({
            cursor: { offset: 0 },
            direction: 'backward',
            limit: 100,
            total: 140,
        })
    ).toBe(0);
});
