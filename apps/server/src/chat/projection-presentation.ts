import type { ChatProjection } from '../storage/chats.ts';
import { parseChatRawJson } from '../storage/chats.ts';

export function presentChatProjectionLabel(chat: ChatProjection) {
    const runtimeChat = parseChatRawJson(chat);
    const platformMetadata = runtimeChat.platformMetadata;

    if (platformMetadata?.provider === 'discord') {
        if (runtimeChat.scope === 'channel') {
            const name = platformMetadata.channel?.name;

            if (name) {
                return name.startsWith('#') ? name : `#${name}`;
            }

            return platformMetadata.channel?.id
                ? `Discord channel ${platformMetadata.channel.id}`
                : 'Discord channel';
        }

        if (runtimeChat.scope === 'dm') {
            return (
                platformMetadata.observedLabels[0] ?? platformMetadata.dm?.userId ?? 'Discord DM'
            );
        }

        return platformMetadata.observedLabels[0] ?? runtimeChat.target ?? runtimeChat.id;
    }

    const tavern =
        typeof runtimeChat.metadata.tavern === 'object' && runtimeChat.metadata.tavern !== null
            ? (runtimeChat.metadata.tavern as Record<string, unknown>)
            : null;
    const tavernDisplayName = tavern?.displayName;

    if (typeof tavernDisplayName === 'string' && tavernDisplayName.trim()) {
        return tavernDisplayName.trim();
    }

    return runtimeChat.target ?? runtimeChat.id;
}
