import type { IconSvgElement } from '@hugeicons/react';
import {
    Alert02Icon,
    AlertCircleIcon,
    CancelCircleIcon,
    CheckmarkCircle02Icon,
    CircleIcon,
    DashedLineCircleIcon,
    HelpCircleIcon,
    Loading03Icon,
    ViewIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { TaskRecord } from '../../lib/trpc.tsx';

export type TaskView = 'all' | 'active' | 'backlog' | 'mine' | 'epics' | 'calendar';
export type TaskAssigneeFilter = 'anyone' | 'me' | 'unassigned' | `agent:${string}`;
// 'all', or a specific label id.
export type TaskLabelFilter = 'all' | string;

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

export const taskStatusIcons: Record<TaskStatus, IconSvgElement> = {
    backlog: DashedLineCircleIcon,
    blocked: AlertCircleIcon,
    canceled: CancelCircleIcon,
    done: CheckmarkCircle02Icon,
    in_progress: Loading03Icon,
    review: ViewIcon,
    todo: CircleIcon,
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

export const taskBlockedReasonIcons: Record<TaskBlockedReasonKind, IconSvgElement> = {
    error: Alert02Icon,
    needs_input: HelpCircleIcon,
};

export const taskBlockedReasonBadgeVariants: Record<TaskBlockedReasonKind, 'error' | 'warning'> = {
    error: 'error',
    needs_input: 'warning',
};

export type TaskDispatchTrigger = NonNullable<TaskRecord['dispatchTrigger']>;

// How the running or last turn was started, shown as quiet detail metadata.
export const taskDispatchTriggerLabels: Record<TaskDispatchTrigger, string> = {
    auto: 'Auto-dispatched',
    manual: 'Dispatched manually',
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

// Today in local YYYY-MM-DD, so scheduledFor comparisons match the calendar
// day the user sees rather than a UTC boundary.
export function todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// A YYYY-MM-DD date as a short label, e.g. "Jul 20". Parsed at local midnight
// to avoid a UTC day shift.
export function formatScheduledForShort(scheduledFor: string): string {
    return new Date(`${scheduledFor}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
    });
}

export interface TaskWaiting {
    // The soonest date the task is held until, when in the future.
    scheduledLabel: string | null;
    // The first unmet dependency and how many more remain.
    waitsOn: { firstNumber: number; more: number } | null;
}

// A todo task is waiting when a dependency is unfinished or its scheduledFor is
// still in the future. Informational only — the task keeps its status.
export function describeTaskWaiting(
    task: TaskRecord,
    tasksById: Map<string, TaskRecord>
): TaskWaiting | null {
    if (task.kind !== 'task' || task.status !== 'todo') {
        return null;
    }

    const unmet = task.blockedBy
        .map((id) => tasksById.get(id))
        .filter((dep): dep is TaskRecord => dep != null && dep.status !== 'done');

    const scheduledLabel =
        task.scheduledFor && task.scheduledFor > todayIsoDate()
            ? formatScheduledForShort(task.scheduledFor)
            : null;

    const firstUnmet = unmet[0];
    const waitsOn = firstUnmet ? { firstNumber: firstUnmet.number, more: unmet.length - 1 } : null;

    if (!(waitsOn || scheduledLabel)) {
        return null;
    }

    return { scheduledLabel, waitsOn };
}

// A dispatched turn is live while the task holds an active run id.
export function isTaskRunning(task: TaskRecord) {
    return task.activeDispatchRunId !== null;
}

// A todo task an agent owns that is clear to run now: dependencies met and its
// scheduledFor date arrived. Mirrors describeTaskWaiting, which reports the
// inverse (why a task is still held).
export function isTaskDispatchEligible(task: TaskRecord, tasksById: Map<string, TaskRecord>) {
    return (
        task.kind === 'task' &&
        task.status === 'todo' &&
        task.assignee?.kind === 'agent' &&
        !isTaskRunning(task) &&
        describeTaskWaiting(task, tasksById) === null
    );
}

export interface DispatchQueueSummary {
    queued: number;
    running: number;
}

// Live board pulse for the auto-dispatch toolbar indicator: how many tasks are
// running now and how many eligible tasks are waiting their turn.
export function summarizeDispatchQueue(
    tasks: TaskRecord[],
    tasksById: Map<string, TaskRecord>
): DispatchQueueSummary {
    let running = 0;
    let queued = 0;

    for (const task of tasks) {
        if (isTaskRunning(task)) {
            running += 1;
        } else if (isTaskDispatchEligible(task, tasksById)) {
            queued += 1;
        }
    }

    return { queued, running };
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
    label: TaskLabelFilter;
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

        if (input.label !== 'all' && !task.labels.some((label) => label.id === input.label)) {
            return false;
        }

        if (!query) {
            return true;
        }

        return (
            task.title.toLowerCase().includes(query) ||
            (task.description?.toLowerCase().includes(query) ?? false) ||
            formatTaskNumber(task).toLowerCase() === query ||
            task.labels.some((label) => label.name.toLowerCase().includes(query))
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
