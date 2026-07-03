import * as React from 'react';
import { SemanticMemory } from '../../features/memory/semantic/semantic-memory.tsx';
import { GridPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function MemoryPage() {
    return (
        <React.Suspense fallback={<GridPageSkeleton />}>
            <SemanticMemory />
        </React.Suspense>
    );
}
