import * as React from 'react';
import { Cortex } from '../../features/cortex/cortex.tsx';
import { GridPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function CortexPage() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <Cortex />
        </React.Suspense>
    );
}
