import * as React from 'react';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import type { AgentSelectOption } from '../agents/agent-option-label.tsx';

export function useTaskAgentOptions(
    agents: AgentListOutput['agents'] | undefined
): AgentSelectOption[] {
    return React.useMemo(
        () =>
            (agents ?? []).map((agent) => ({
                character: agent.effectiveCharacter,
                id: agent.id,
                name: agent.name,
                primaryColor: agent.effectivePrimaryColor,
            })),
        [agents]
    );
}
