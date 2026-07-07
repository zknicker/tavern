import * as React from 'react';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { TaskNew } from '../../features/tasks/task-new.tsx';

export function TaskNewPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <TaskNew />
        </React.Suspense>
    );
}
