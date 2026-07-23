import type { ReminderFilter } from './filter-reminders.ts';

/** What the reminders sidebar has selected: a status filter over the list, a
    run-history view, or one agent's reminders. Ported from
    automations-selection.ts. */
export type ReminderSelection =
    | { filter: ReminderFilter; kind: 'filter' }
    | { failuresOnly: boolean; kind: 'runs' }
    | { agentId: string; kind: 'agent' };

export const defaultReminderSelection: ReminderSelection = {
    filter: 'all',
    kind: 'filter',
};

export function isSameReminderSelection(a: ReminderSelection, b: ReminderSelection) {
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
