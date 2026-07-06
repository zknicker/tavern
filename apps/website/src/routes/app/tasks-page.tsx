import * as React from 'react';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { Tasks } from '../../features/tasks/tasks.tsx';

export function TasksPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <Tasks />
        </React.Suspense>
    );
}
