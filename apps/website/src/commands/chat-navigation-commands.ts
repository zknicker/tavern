import type { ChatListItem } from '../features/chats/chat-list-data.ts';
import { getChatAgentId } from '../features/chats/chat-list-data.ts';
import { buildChatPath } from '../features/chats/chat-path.ts';
import {
    buildSidebarChatGroups,
    getSidebarChatTitle,
} from '../features/shell/sidebar-chat-list-model.ts';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildChatNavigationCommandGroups(
    context: AppCommandBuildContext
): AppCommandGroup[] {
    const groups = buildSidebarChatGroups([...context.chats]);

    return [
        {
            commands: groups.channels.map((chat) => buildChatNavigationCommand(context, chat)),
            id: 'channels',
            title: 'Channels',
        },
        {
            commands: groups.directMessages.map((chat) =>
                buildChatNavigationCommand(context, chat)
            ),
            id: 'direct-messages',
            title: 'Direct Messages',
        },
    ];
}

function buildChatNavigationCommand(
    context: AppCommandBuildContext,
    chat: ChatListItem
): AppCommandGroup['commands'][number] {
    const title = getSidebarChatTitle(chat);
    const isChannel = chat.conversationKind === 'channel';

    return {
        icon: isChannel
            ? { color: chat.tabAppearance.color, kind: 'channel' }
            : {
                  agentId: getChatAgentId(chat),
                  fallbackLabel: getChatIconFallbackLabel(chat),
                  kind: 'agent-avatar',
              },
        id: `chat.${chat.id}`,
        keywords: [
            'chat',
            isChannel ? 'channel' : 'direct message',
            isChannel ? 'room' : 'dm',
            chat.searchText,
            chat.lastActivityLabel,
        ],
        run: () => context.navigate(buildChatPath(chat.id)),
        title,
    };
}

function getChatIconFallbackLabel(chat: ChatListItem) {
    return chat.targetParticipant?.name ?? chat.participants[0]?.name ?? chat.title;
}
