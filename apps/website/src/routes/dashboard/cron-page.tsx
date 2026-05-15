import * as React from 'react';
import { Cron } from '../../features/cron/cron.tsx';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function CronPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <Cron />
        </React.Suspense>
    );
}
