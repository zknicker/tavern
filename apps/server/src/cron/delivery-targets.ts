import type { AgentRuntimeChat } from '@tavern/api';
import { listChatProjections, parseChatRawJson } from '../storage/chats.ts';
import { type CronDeliveryTarget, cronDeliveryTargetListSchema } from './contracts.ts';

function isDeliverableAgentRuntimeChat(chat: AgentRuntimeChat) {
    return chat.platform === 'tavern' || Boolean(chat.bindingId && chat.target);
}

function presentCronDeliveryTargetLabel(chat: AgentRuntimeChat) {
    if (chat.platformMetadata?.provider === 'discord') {
        if (chat.scope === 'channel') {
            const channelName = chat.platformMetadata.channel?.name;

            if (channelName) {
                return channelName.startsWith('#') ? channelName : `#${channelName}`;
            }

            return chat.platformMetadata.channel?.id
                ? `Discord channel ${chat.platformMetadata.channel.id}`
                : 'Discord channel';
        }

        if (chat.scope === 'dm') {
            return (
                chat.platformMetadata.observedLabels[0] ??
                chat.platformMetadata.dm?.userId ??
                'Discord DM'
            );
        }
    }

    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : null;
    const tavernDisplayName = tavern?.displayName;

    if (typeof tavernDisplayName === 'string' && tavernDisplayName.trim()) {
        return tavernDisplayName.trim();
    }

    return chat.target ?? chat.id;
}

export function buildCronDeliveryTargets(chats: AgentRuntimeChat[]) {
    const targets = new Map<string, CronDeliveryTarget>();

    for (const chat of chats) {
        if (!isDeliverableAgentRuntimeChat(chat) || targets.has(chat.id)) {
            continue;
        }

        targets.set(chat.id, {
            chatId: chat.id,
            label: presentCronDeliveryTargetLabel(chat),
            platform: chat.platform,
            scope: chat.scope,
        });
    }

    return [...targets.values()].sort((left, right) => {
        const labelComparison = left.label.localeCompare(right.label);

        if (labelComparison !== 0) {
            return labelComparison;
        }

        return left.chatId.localeCompare(right.chatId);
    });
}

export async function listCronDeliveryTargets() {
    const chats = (await listChatProjections()).map(parseChatRawJson);

    return cronDeliveryTargetListSchema.parse({
        targets: buildCronDeliveryTargets(chats),
    });
}
