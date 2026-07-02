import { useMemo } from 'react';
import type { HeadName } from '../../features/chats/agent-face.tsx';
import { useAgentList } from './use-agent-list.ts';

export interface AgentFaceAppearance {
    character: HeadName;
    primaryColor: string | null;
}

const noneAppearance: AgentFaceAppearance = { character: 'none', primaryColor: null };

// Resolve an agent id to its face appearance (character + configured color).
// Non-agents (and unknown ids) resolve to 'none' so callers can fall back to
// their normal avatar.
export function useAgentAppearanceLookup(): (
    agentId: string | null | undefined
) => AgentFaceAppearance {
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents;

    return useMemo(() => {
        const appearanceById = new Map<string, AgentFaceAppearance>(
            agents?.map((agent) => [
                agent.id,
                {
                    character: agent.effectiveCharacter,
                    primaryColor: agent.effectivePrimaryColor,
                },
            ])
        );

        return (agentId: string | null | undefined): AgentFaceAppearance =>
            (agentId ? appearanceById.get(agentId) : null) ?? noneAppearance;
    }, [agents]);
}
