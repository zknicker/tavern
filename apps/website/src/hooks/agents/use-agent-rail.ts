import { useMemo } from 'react';
import type { AgentActivityOutput, AgentListOutput } from '../../lib/trpc.tsx';
import { resolveAgentGlyph } from './use-agent-avatar-directory.ts';

export function useAgentRail(
    agents: AgentListOutput['agents'],
    activity: AgentActivityOutput['activity']
) {
    return useMemo(() => {
        const activityByAgentId = new Map(activity.map((entry) => [entry.agentId, entry]));

        return agents.map((agent) => ({
            avatar: resolveAgentGlyph(agent),
            id: agent.id,
            isThinking: activityByAgentId.get(agent.id)?.state === 'thinking',
            name: agent.name,
            primaryColor: agent.effectivePrimaryColor,
        }));
    }, [activity, agents]);
}

export type AgentRailItem = ReturnType<typeof useAgentRail>[number];
