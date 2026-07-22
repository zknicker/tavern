import type { AgentListOutput } from '../../lib/trpc.tsx';

export function createNewAgentName(agents: AgentListOutput['agents']) {
    const names = new Set(agents.map((agent) => agent.name.trim().toLowerCase()));
    if (!names.has('new-agent')) {
        return 'new-agent';
    }

    let suffix = 2;
    while (names.has(`new-agent-${suffix}`)) {
        suffix += 1;
    }
    return `new-agent-${suffix}`;
}
