import { useMemo } from 'react';
import type { HeadKind } from '../../features/chats/agent-face.tsx';
import { useAgentList } from './use-agent-list.ts';

// Resolve an agent id to its character face. Non-agents (and unknown ids)
// resolve to 'none' so callers can fall back to their normal avatar.
export function useAgentCharacterLookup(): (agentId: string | null | undefined) => HeadKind {
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents;

    return useMemo(() => {
        const charactersById = new Map(
            agents?.map((agent) => [agent.id, agent.effectiveCharacter])
        );

        return (agentId: string | null | undefined): HeadKind =>
            (agentId ? charactersById.get(agentId) : null) ?? 'none';
    }, [agents]);
}
