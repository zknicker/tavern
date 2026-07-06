import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { TaskDetail } from '../../features/tasks/task-detail.tsx';
import { appRoutes } from '../../lib/app-routes.ts';

export function TaskDetailPage() {
    const { taskId } = useParams<{ taskId: string }>();

    if (!taskId) {
        return <Navigate replace to={appRoutes.tasks} />;
    }

    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <TaskDetail taskId={taskId} />
        </React.Suspense>
    );
}
