import { getChatDisplayTitle } from '../../components/chats/chat-display.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { ChatListOutput } from '../../lib/trpc.tsx';

export function buildChatList(chats: ChatListOutput['chats']) {
    return chats.map((chat) => {
        const title = getChatDisplayTitle(chat);

        return {
            ...chat,
            hasActivity: chat.sessionCount > 0,
            isDisabled: !chat.isEnabled,
            lastActivityLabel: chat.lastActivityAt
                ? formatRelativeTime(chat.lastActivityAt)
                : 'no activity yet',
            agentRuntimeSyncLabel:
                chat.agentRuntimeSync?.status === 'error'
                    ? (chat.agentRuntimeSync.lastError ?? 'Runtime sync failed')
                    : chat.agentRuntimeSync?.status === 'pending'
                      ? 'Waiting for runtime sync'
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
    });
}

export type ChatListItem = ReturnType<typeof buildChatList>[number];
