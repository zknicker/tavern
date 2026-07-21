import * as React from 'react';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { Tasks } from '../../features/tasks/tasks.tsx';
import { useMarkTasksSeen } from '../../hooks/shell/use-mark-tasks-seen.ts';

export function TasksPage() {
    useMarkTasksSeen();

    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <Tasks />
        </React.Suspense>
    );
}
