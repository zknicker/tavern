import type { TaskRecord } from '../../lib/trpc.tsx';

export type TaskView = 'all' | 'active' | 'backlog' | 'mine' | 'epics';
export type TaskAssigneeFilter = 'anyone' | 'me' | 'unassigned' | `agent:${string}`;

export type TaskStatus = TaskRecord['status'];
export type TaskPriority = TaskRecord['priority'];

export const taskStatusOrder: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'canceled'];

export const taskStatusLabels: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    canceled: 'Canceled',
    done: 'Done',
    in_progress: 'In progress',
    todo: 'Todo',
};

export const taskStatusBadgeVariants: Record<
    TaskStatus,
    'info' | 'subtle' | 'success' | 'warning'
> = {
    backlog: 'subtle',
    canceled: 'subtle',
    done: 'success',
    in_progress: 'info',
    todo: 'warning',
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

export function isActiveTask(task: TaskRecord) {
    return task.status === 'todo' || task.status === 'in_progress';
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
