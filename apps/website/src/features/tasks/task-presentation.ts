import type { TaskRecord } from '../../lib/trpc.tsx';

export type TaskView = 'all' | 'active' | 'backlog' | 'mine' | 'epics';
export type TaskAssigneeFilter = 'anyone' | 'me' | 'unassigned' | `agent:${string}`;

export type TaskStatus = TaskRecord['status'];
export type TaskPriority = TaskRecord['priority'];
export type TaskBlockedReason = NonNullable<TaskRecord['blockedReason']>;
export type TaskBlockedReasonKind = TaskBlockedReason['kind'];

export const taskStatusOrder: TaskStatus[] = [
    'backlog',
    'todo',
    'in_progress',
    'blocked',
    'review',
    'done',
    'canceled',
];

export const taskStatusLabels: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    blocked: 'Blocked',
    canceled: 'Canceled',
    done: 'Done',
    in_progress: 'In progress',
    review: 'In review',
    todo: 'Todo',
};

export const taskStatusBadgeVariants: Record<
    TaskStatus,
    'error' | 'info' | 'subtle' | 'success' | 'warning'
> = {
    backlog: 'subtle',
    blocked: 'error',
    canceled: 'subtle',
    done: 'success',
    in_progress: 'info',
    review: 'info',
    todo: 'warning',
};

// Blocked reasons read differently on the board: needs_input asks the user to
// answer, error reports a failure to fix.
export const taskBlockedReasonLabels: Record<TaskBlockedReasonKind, string> = {
    error: 'Failed',
    needs_input: 'Needs input',
};

export const taskBlockedReasonBadgeVariants: Record<TaskBlockedReasonKind, 'error' | 'warning'> = {
    error: 'error',
    needs_input: 'warning',
};

export const taskPriorityOrder: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

export const taskPriorityLabels: Record<TaskPriority, string> = {
    high: 'High',
    low: 'Low',
    medium: 'Medium',
    none: 'No priority',
    urgent: 'Urgent',
};

export function formatTaskNumber(task: Pick<TaskRecord, 'number'>) {
    return `T-${task.number}`;
}

// Active = live or demanding attention: queued, running, stuck, or awaiting
// the user's check. Terminal and triage states stay out.
export function isActiveTask(task: TaskRecord) {
    return (
        task.status === 'todo' ||
        task.status === 'in_progress' ||
        task.status === 'blocked' ||
        task.status === 'review'
    );
}

export function groupTasksByStatus(tasks: TaskRecord[]) {
    return taskStatusOrder
        .map((status) => ({
            status,
            tasks: tasks.filter((task) => task.status === status),
        }))
        .filter((group) => group.tasks.length > 0);
}

export function filterTasks(input: {
    assignee: TaskAssigneeFilter;
    query: string;
    tasks: TaskRecord[];
    view: TaskView;
}) {
    const query = input.query.trim().toLowerCase();

    return input.tasks.filter((task) => {
        if (!matchesView(task, input.view)) {
            return false;
        }

        if (!matchesAssignee(task, input.assignee)) {
            return false;
        }

        if (!query) {
            return true;
        }

        return (
            task.title.toLowerCase().includes(query) ||
            (task.description?.toLowerCase().includes(query) ?? false) ||
            formatTaskNumber(task).toLowerCase() === query ||
            task.labels.some((label) => label.toLowerCase().includes(query))
        );
    });
}

function matchesView(task: TaskRecord, view: TaskView) {
    switch (view) {
        case 'active':
            return task.kind === 'task' && isActiveTask(task);
        case 'backlog':
            return task.kind === 'task' && task.status === 'backlog';
        case 'epics':
            return task.kind === 'epic';
        case 'mine':
            return task.assignee?.kind === 'user';
        default:
            return true;
    }
}

function matchesAssignee(task: TaskRecord, assignee: TaskAssigneeFilter) {
    if (assignee === 'anyone') {
        return true;
    }

    if (assignee === 'unassigned') {
        return task.assignee === null;
    }

    if (assignee === 'me') {
        return task.assignee?.kind === 'user';
    }

    return (
        task.assignee?.kind === 'agent' && task.assignee.agentId === assignee.slice('agent:'.length)
    );
}
