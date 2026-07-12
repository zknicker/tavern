import type { ChatListItem } from './chat-list-data.ts';

export interface ArchivedChatGroup {
    chats: ChatListItem[];
    key: 'channels' | 'directMessages' | 'other';
    label: string;
}

// Grouped by conversation kind so future kinds (task chats, for example) land
// in their own section instead of forcing a page redesign.
export function buildArchivedChatGroups(chats: ChatListItem[]): ArchivedChatGroup[] {
    const tavernChats = chats.filter((chat) => chat.type === 'tavern');
    const groups: ArchivedChatGroup[] = [
        {
            chats: tavernChats.filter((chat) => chat.conversationKind === 'channel'),
            key: 'channels',
            label: 'Channels',
        },
        {
            chats: tavernChats.filter((chat) => chat.conversationKind === 'direct'),
            key: 'directMessages',
            label: 'Direct messages',
        },
        {
            chats: tavernChats.filter(
                (chat) => chat.conversationKind !== 'channel' && chat.conversationKind !== 'direct'
            ),
            key: 'other',
            label: 'Other chats',
        },
    ];

    return groups.filter((group) => group.chats.length > 0);
}
