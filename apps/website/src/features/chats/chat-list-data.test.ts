import { describe, expect, test } from 'bun:test';
import { getChatLastActivityLabel } from './chat-list-data.ts';

describe('chat list data', () => {
    test('derives last activity labels from the caller clock', () => {
        expect(
            getChatLastActivityLabel(
                { lastActivityAt: '2026-07-07T19:44:52.918Z' },
                Date.parse('2026-07-07T19:45:30.000Z')
            )
        ).toBe('just now');

        expect(
            getChatLastActivityLabel(
                { lastActivityAt: '2026-07-07T19:44:52.918Z' },
                Date.parse('2026-07-07T20:14:52.918Z')
            )
        ).toBe('30m ago');
    });

    test('labels chats without activity explicitly', () => {
        expect(getChatLastActivityLabel({ lastActivityAt: null })).toBe('no activity yet');
    });
});
