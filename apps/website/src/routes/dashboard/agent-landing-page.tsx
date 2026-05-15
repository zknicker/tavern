import * as React from 'react';
import { AgentHome } from '../../features/agents/agent-home.tsx';
import { GridPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function AgentLandingPage() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <AgentHome />
        </React.Suspense>
    );
}
