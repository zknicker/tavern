import * as React from 'react';
import { useTaskList } from '../tasks/use-task-list.ts';
import { markTasksSeen } from './use-rail-unseen.ts';

// Records the displayed task revisions while any full /tasks route (list,
// new, detail) is open. The embedded conversation tab deliberately does not
// stamp: seeing one conversation's tasks is not seeing them all.
export function useMarkTasksSeen() {
    const tasksQuery = useTaskList();
    const tasks = tasksQuery.data?.tasks;

    React.useEffect(() => {
        if (!tasks) {
            return;
        }

        markTasksSeen(tasks);
    }, [tasks]);
}
