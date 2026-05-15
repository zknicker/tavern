import * as React from 'react';
import { Overview } from '../../features/overview/overview.tsx';
import { OverviewPageSkeleton } from '../../features/overview/overview-page-skeleton.tsx';

export function OverviewPage() {
    return (
        <React.Suspense fallback={<OverviewPageSkeleton />}>
            <Overview />
        </React.Suspense>
    );
}
