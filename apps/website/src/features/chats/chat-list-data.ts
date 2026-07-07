import { getChatDisplayTitle } from '../../components/chats/chat-display.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { ChatListOutput } from '../../lib/trpc.tsx';

export type ChatListRecord = ChatListOutput['itemsById'][string];

export function buildChatList(chatList: ChatListOutput | null | undefined) {
    if (!chatList) {
        return [];
    }

    return chatList.ids.flatMap((chatId) => {
        const chat = chatList.itemsById[chatId];

        return chat ? [buildChatListItem(chat)] : [];
    });
}

export function buildChatListItem(chat: ChatListRecord) {
    const title = getChatDisplayTitle(chat);

    return {
        ...chat,
        hasActivity: chat.sessionCount > 0,
        isDisabled: !chat.isEnabled,
        agentRuntimeSyncLabel:
            chat.agentRuntimeSync?.status === 'error'
                ? (chat.agentRuntimeSync.lastError ?? 'Runtime update failed')
                : chat.agentRuntimeSync?.status === 'pending'
                  ? 'Waiting for Runtime update'
                  : null,
        title,
        searchText: [
            title,
            chat.displayName,
            chat.type,
            chat.source.label,
            chat.source.kind,
            chat.scope ?? '',
            ...chat.participants.map((participant) => participant.name),
            chat.latestSession?.title ?? '',
        ]
            .join('\n')
            .toLowerCase(),
    };
}

export type ChatListItem = ReturnType<typeof buildChatList>[number];

export function getChatLastActivityLabel(
    chat: Pick<ChatListRecord, 'lastActivityAt'>,
    now?: number
) {
    return chat.lastActivityAt ? formatRelativeTime(chat.lastActivityAt, now) : 'no activity yet';
}

// The agent whose avatar represents this chat (DM rows, tab favicons, room
// topbars). Prefers the agent participant, falling back to the bound agent.
export function getChatAgentId(chat: ChatListItem) {
    return (
        chat.participants.find((participant) => participant.actorType === 'agent')?.actorId ??
        chat.boundAgentIds[0] ??
        null
    );
}
