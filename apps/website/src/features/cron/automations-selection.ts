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
