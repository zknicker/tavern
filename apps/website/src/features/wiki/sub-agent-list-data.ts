import type { SubAgentListOutput } from '../../lib/trpc.tsx';

function getSubAgentStatus(state: SubAgentListOutput['subAgents'][number]['state']) {
    switch (state) {
        case 'running':
            return 'active' as const;
        case 'failed':
            return 'stopped' as const;
        default:
            return 'idle' as const;
    }
}

export function buildSubAgentList(subAgents: SubAgentListOutput['subAgents']) {
    return subAgents.map((subAgent) => ({
        createdAt: subAgent.lastActiveAt,
        id: subAgent.id,
        name: subAgent.name,
        parentId: subAgent.parentId,
        status: getSubAgentStatus(subAgent.state),
        taskCount: 1,
    }));
}

export type SubAgentListItem = ReturnType<typeof buildSubAgentList>[number];
