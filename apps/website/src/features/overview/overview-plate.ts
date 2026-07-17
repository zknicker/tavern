import type { TaskRecord } from '../../lib/trpc.tsx';

const plateStatusRank: Record<TaskRecord['status'], number> = {
    backlog: 4,
    blocked: 1,
    canceled: 5,
    done: 5,
    in_progress: 2,
    review: 0,
    todo: 3,
};

// The home-page plate: work that wants the user's eyes first. In review beats
// blocked beats in-progress beats todo; backlog/done/canceled never surface.
// Agent-owned open tasks are the agent's problem, not the user's plate.
export function pickPlateTasks(tasks: TaskRecord[], limit: number): TaskRecord[] {
    return tasks
        .filter((task) => isPlateTask(task))
        .sort(
            (left, right) =>
                plateStatusRank[left.status] - plateStatusRank[right.status] ||
                left.number - right.number
        )
        .slice(0, limit);
}

function isPlateTask(task: TaskRecord): boolean {
    if (task.status === 'review' || task.status === 'blocked') {
        return true;
    }

    if (task.assignee?.kind === 'user') {
        return task.status === 'todo' || task.status === 'in_progress';
    }

    return false;
}
