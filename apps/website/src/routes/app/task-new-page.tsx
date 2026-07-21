import * as React from 'react';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { TaskNew } from '../../features/tasks/task-new.tsx';
import { useMarkTasksSeen } from '../../hooks/shell/use-mark-tasks-seen.ts';

export function TaskNewPage() {
    useMarkTasksSeen();

    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <TaskNew />
        </React.Suspense>
    );
}
