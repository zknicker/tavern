import type { AgentListOutput } from '../../../lib/trpc.tsx';

export function selectSettingsAgent(
    agents: AgentListOutput['agents'],
    selectedAgentId: null | string
) {
    if (selectedAgentId) {
        const selected = agents.find((agent) => agent.id === selectedAgentId);
        if (selected) {
            return selected;
        }
    }

    return agents[0] ?? null;
}

export function createNewAgentName(agents: AgentListOutput['agents']) {
    const names = new Set(agents.map((agent) => agent.name.trim().toLowerCase()));
    if (!names.has('new agent')) {
        return 'New agent';
    }

    let suffix = 2;
    while (names.has(`new agent ${suffix}`)) {
        suffix += 1;
    }
    return `New agent ${suffix}`;
}
