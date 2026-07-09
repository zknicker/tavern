import type { AgentRuntimeTask } from '@tavern/api';

export interface AutoDispatchEligibility {
    agentAtCapacity: boolean;
    agentAutoDispatchEnabled: boolean;
    agentBusy: boolean;
    dependenciesDone: boolean;
    globalAtCapacity: boolean;
    globalEnabled: boolean;
    localDate: string;
}

export function isAutoDispatchEligible(task: AgentRuntimeTask, state: AutoDispatchEligibility) {
    return (
        state.globalEnabled &&
        !state.globalAtCapacity &&
        task.kind === 'task' &&
        task.status === 'todo' &&
        task.assignee?.kind === 'agent' &&
        state.agentAutoDispatchEnabled &&
        state.dependenciesDone &&
        (!task.scheduledFor || task.scheduledFor <= state.localDate) &&
        !task.activeDispatchRunId &&
        !state.agentAtCapacity &&
        !state.agentBusy
    );
}

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;

export function orderAutoDispatchTasks(tasks: AgentRuntimeTask[]) {
    return [...tasks].sort(
        (left, right) =>
            priorityRank[left.priority] - priorityRank[right.priority] ||
            left.updatedAt.localeCompare(right.updatedAt) ||
            left.id.localeCompare(right.id)
    );
}
