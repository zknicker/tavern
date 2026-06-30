import { defaultAgentEngineAgentId } from '../agent-engine/constants';
import type { Database } from '../db/sqlite';
import { createChat, getChat } from './chat-api';

export const defaultWorkspaceChannelId = 'cht_general';
export const defaultAgentDmChatId = 'cht_tavern_agent_dm';
export const localHumanParticipantId = 'usr_tavern';
export const defaultWorkspaceChannelColor = '#f97316';

export function seedWorkspaceChats(input: { agentId?: string; agentName?: string; db: Database }) {
    const agentId = input.agentId ?? defaultAgentEngineAgentId;
    const agentName = input.agentName ?? 'Tavern';
    let seeded = 0;

    if (!getChat(defaultWorkspaceChannelId, input.db)) {
        seeded += 1;
    }
    createChat(
        {
            id: defaultWorkspaceChannelId,
            kind: 'channel',
            metadata: runtimeTavernChatMetadata({
                agentIds: [agentId],
                color: defaultWorkspaceChannelColor,
                displayName: 'general',
                kind: 'channel',
            }),
            participants: [
                {
                    id: localHumanParticipantId,
                    kind: 'user',
                    label: 'You',
                    metadata: { source: 'tavern' },
                },
                {
                    id: agentId,
                    kind: 'agent',
                    label: agentName,
                    metadata: { agentId, source: 'tavern' },
                },
            ],
            title: 'general',
        },
        input.db
    );

    if (!getChat(defaultAgentDmChatId, input.db)) {
        seeded += 1;
    }
    createChat(
        {
            id: defaultAgentDmChatId,
            kind: 'dm',
            metadata: runtimeTavernChatMetadata({
                agentIds: [agentId],
                displayName: agentName,
                kind: 'dm',
            }),
            participants: [
                {
                    id: localHumanParticipantId,
                    kind: 'user',
                    label: 'You',
                    metadata: { source: 'tavern' },
                },
                {
                    id: agentId,
                    kind: 'agent',
                    label: agentName,
                    metadata: { agentId, source: 'tavern' },
                },
            ],
            title: agentName,
        },
        input.db
    );

    return { seeded };
}

function runtimeTavernChatMetadata(input: {
    agentIds: string[];
    color?: string | null;
    displayName: string;
    kind: 'channel' | 'dm';
}) {
    return {
        runtime: { source: 'tavern' },
        tavern: {
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            displayNameSource: 'explicit',
            kind: input.kind,
            tabAppearance: { color: input.color ?? null },
        },
    };
}
