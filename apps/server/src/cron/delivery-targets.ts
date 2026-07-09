import type { AgentRuntimeChat } from '@tavern/api';
import { listRuntimeChatRecords } from '../chat/runtime-chats.ts';
import {
    type CronDeliveryTarget,
    cronDeliveryTargetListSchema,
    listCronDeliveryTargetsInputSchema,
} from './contracts.ts';

function isDeliverableAgentRuntimeChat(chat: AgentRuntimeChat) {
    return chat.platform === 'tavern' || Boolean(chat.bindingId && chat.target);
}

function getAgentParticipantIds(agentId: string) {
    return new Set([agentId, `agt_${agentId}`]);
}

function hasAgentParticipant(chat: AgentRuntimeChat, agentId: string) {
    const participantIds = getAgentParticipantIds(agentId);

    return chat.participants.some(
        (participant) => participant.type === 'agent' && participantIds.has(participant.agentId)
    );
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

export function buildCronDeliveryTargets(chats: AgentRuntimeChat[], agentId: string) {
    const targets = new Map<string, CronDeliveryTarget>();

    for (const chat of chats) {
        if (
            chat.scope === 'task' ||
            !(isDeliverableAgentRuntimeChat(chat) && hasAgentParticipant(chat, agentId)) ||
            targets.has(chat.id)
        ) {
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

export async function listCronDeliveryTargets(input: unknown) {
    const parsed = listCronDeliveryTargetsInputSchema.parse(input);
    const chats = (await listRuntimeChatRecords()).map((record) => record.chat);

    return cronDeliveryTargetListSchema.parse({
        targets: buildCronDeliveryTargets(chats, parsed.agentId),
    });
}
