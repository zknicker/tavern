import { describe, expect, test } from 'bun:test';
import { supportsChatViewTabs } from './chat-view-tabs.tsx';

describe('supportsChatViewTabs', () => {
    test.each([
        ['channel', true],
        ['direct', true],
        ['task', false],
    ])('returns %s eligibility for Tavern %s chats', (conversationKind, expected) => {
        expect(supportsChatViewTabs({ conversationKind, type: 'tavern' })).toBe(expected);
    });

    test('excludes non-Tavern chats', () => {
        expect(supportsChatViewTabs({ conversationKind: 'channel', type: 'discord' })).toBe(false);
    });
});
