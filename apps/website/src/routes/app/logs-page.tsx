import * as React from 'react';
import { Logs } from '../../features/logs/logs.tsx';
import { SplitViewSkeleton } from '../../features/shell/page-skeletons.tsx';

export function LogsPage() {
    return (
        <React.Suspense fallback={<SplitViewSkeleton />}>
            <Logs />
        </React.Suspense>
    );
}
