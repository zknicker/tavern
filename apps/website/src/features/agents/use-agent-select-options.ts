import * as React from 'react';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import type { AgentSelectOption } from './agent-option-label.tsx';

export function useAgentSelectOptions(
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
