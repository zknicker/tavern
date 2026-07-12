import { describe, expect, test } from 'bun:test';
import { buildArchivedChatGroups } from './archived-chats-model.ts';
import type { ChatListItem } from './chat-list-data.ts';

function createChat(overrides: Partial<ChatListItem> = {}): ChatListItem {
    return {
        conversationKind: 'channel',
        id: 'chat-1',
        type: 'tavern',
        ...overrides,
    } as ChatListItem;
}

describe('buildArchivedChatGroups', () => {
    test('splits tavern chats into channel and direct sections', () => {
        const groups = buildArchivedChatGroups([
            createChat({ conversationKind: 'channel', id: 'chat-channel' }),
            createChat({ conversationKind: 'direct', id: 'chat-dm' }),
        ]);

        expect(groups.map((group) => group.key)).toEqual(['channels', 'directMessages']);
        expect(groups[0]?.chats.map((chat) => chat.id)).toEqual(['chat-channel']);
        expect(groups[1]?.chats.map((chat) => chat.id)).toEqual(['chat-dm']);
    });

    test('omits empty sections and non-tavern chats', () => {
        const groups = buildArchivedChatGroups([
            createChat({ id: 'chat-channel' }),
            createChat({ id: 'chat-discord', type: 'discord' }),
        ]);

        expect(groups.map((group) => group.key)).toEqual(['channels']);
        expect(groups[0]?.chats.map((chat) => chat.id)).toEqual(['chat-channel']);
    });

    test('buckets unrecognized kinds into the other section', () => {
        const groups = buildArchivedChatGroups([
            createChat({ conversationKind: 'group', id: 'chat-group' }),
        ]);

        expect(groups.map((group) => group.key)).toEqual(['other']);
    });

    test('returns no groups for an empty list', () => {
        expect(buildArchivedChatGroups([])).toEqual([]);
    });
});
