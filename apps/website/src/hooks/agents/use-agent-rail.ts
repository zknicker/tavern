import { useMemo } from 'react';
import type { AgentListOutput, AgentPresenceOutput } from '../../lib/trpc.tsx';

export function useAgentRail(
    agents: AgentListOutput['agents'],
    presence: AgentPresenceOutput['presence']
) {
    return useMemo(() => {
        const presenceByAgentId = new Map(presence.map((entry) => [entry.agentId, entry]));

        return agents.map((agent) => ({
            id: agent.id,
            isThinking: presenceByAgentId.get(agent.id)?.state === 'busy',
            name: agent.name,
        }));
    }, [agents, presence]);
}

export type AgentRailItem = ReturnType<typeof useAgentRail>[number];
