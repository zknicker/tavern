import * as React from 'react';
import { Stats } from '../../features/stats/stats.tsx';
import { StatsAvailabilityGate } from '../../features/stats/stats-availability-gate.tsx';
import { StatsPageSkeleton } from '../../features/stats/stats-page-skeleton.tsx';

export function StatsPage() {
    return (
        <React.Suspense fallback={<StatsPageSkeleton />}>
            <StatsAvailabilityGate>
                <Stats />
            </StatsAvailabilityGate>
        </React.Suspense>
    );
}
