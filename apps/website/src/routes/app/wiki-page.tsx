import * as React from 'react';
import { GridPageSkeleton } from '../../features/shell/page-skeletons.tsx';
import { Wiki } from '../../features/wiki/wiki.tsx';

export function WikiPage() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <Wiki />
        </React.Suspense>
    );
}
