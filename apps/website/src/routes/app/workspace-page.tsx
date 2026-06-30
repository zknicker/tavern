import * as React from 'react';
import { SplitViewSkeleton } from '../../features/shell/page-skeletons.tsx';
import { Workspace } from '../../features/workspace/workspace.tsx';

export function WorkspacePage() {
    return (
        <React.Suspense fallback={<SplitViewSkeleton />}>
            <Workspace />
        </React.Suspense>
    );
}
