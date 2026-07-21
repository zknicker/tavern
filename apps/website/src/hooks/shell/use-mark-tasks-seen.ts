import * as React from 'react';
import { useTaskList } from '../tasks/use-task-list.ts';
import { markTasksSeen } from './use-rail-unseen.ts';

// Stamps the rail's tasks-seen watermark while any full /tasks route (list,
// new, detail) is open — on every update the user watches, not just mount.
// Covering the newest loaded updatedAt also absorbs server timestamps that
// run ahead of the local clock. The embedded conversation tab deliberately
// does not stamp: seeing one conversation's tasks is not seeing them all.
export function useMarkTasksSeen() {
    const tasksQuery = useTaskList();
    const tasks = tasksQuery.data?.tasks;

    React.useEffect(() => {
        if (!tasks) {
            return;
        }

        const latestTaskUpdate = tasks.reduce(
            (latest, task) => Math.max(latest, Date.parse(task.updatedAt) || 0),
            0
        );
        markTasksSeen(Math.max(Date.now(), latestTaskUpdate));
    }, [tasks]);
}
