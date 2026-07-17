import type { AgentSelectOption } from '../agents/agent-option-label.tsx';
import type { CronFilter } from './filter-cron-jobs.ts';

/** What the automations sidebar has selected: a status filter over the jobs
    list, a run-history view, or one agent's jobs. */
export type AutomationsSelection =
    | { filter: CronFilter; kind: 'filter' }
    | { failuresOnly: boolean; kind: 'runs' }
    | { agentId: string; kind: 'agent' };

export const defaultAutomationsSelection: AutomationsSelection = {
    filter: 'all',
    kind: 'filter',
};

export function isSameAutomationsSelection(a: AutomationsSelection, b: AutomationsSelection) {
    if (a.kind === 'filter' && b.kind === 'filter') {
        return a.filter === b.filter;
    }

    if (a.kind === 'runs' && b.kind === 'runs') {
        return a.failuresOnly === b.failuresOnly;
    }

    if (a.kind === 'agent' && b.kind === 'agent') {
        return a.agentId === b.agentId;
    }

    return false;
}

export function getAutomationsTitle(
    selection: AutomationsSelection,
    agents: AgentSelectOption[]
): { subtitle: string; title: string } {
    if (selection.kind === 'runs') {
        return selection.failuresOnly
            ? { subtitle: 'Runs that ended in an error.', title: 'Failures' }
            : { subtitle: 'Latest runs across all automations.', title: 'Recent runs' };
    }

    if (selection.kind === 'agent') {
        const name = agents.find((agent) => agent.id === selection.agentId)?.name ?? 'Agent';

        return { subtitle: `Automations owned by ${name}.`, title: name };
    }

    switch (selection.filter) {
        case 'active':
            return { subtitle: 'Automations currently scheduled.', title: 'Active' };
        case 'paused':
            return { subtitle: 'Automations on hold.', title: 'Paused' };
        default:
            return {
                subtitle: 'Schedule recurring work for your agent.',
                title: 'Automations',
            };
    }
}
