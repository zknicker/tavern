import * as React from 'react';
import { useTaskList } from '../tasks/use-task-list.ts';
import { markTasksSeen } from './use-rail-unseen.ts';

// Stamps the rail's tasks-seen watermark while any full /tasks route (list,
// new, detail) is open — on every update the user watches, not just mount.
// The stamp is the newest DISPLAYED updatedAt (never the wall clock), so
// rows that sync in after an outage with earlier timestamps still read as
// unseen. The embedded conversation tab deliberately does not stamp:
// seeing one conversation's tasks is not seeing them all.
export function useMarkTasksSeen() {
    const tasksQuery = useTaskList();
    const tasks = tasksQuery.data?.tasks;

    React.useEffect(() => {
        if (!tasks || tasks.length === 0) {
            return;
        }

        const latestTaskUpdate = tasks.reduce(
            (latest, task) => Math.max(latest, Date.parse(task.updatedAt) || 0),
            0
        );
        if (latestTaskUpdate > 0) {
            markTasksSeen(latestTaskUpdate);
        }
    }, [tasks]);
}
