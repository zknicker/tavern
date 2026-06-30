import * as React from 'react';
import { CronAvailabilityGate } from '../../features/cron/cron-availability-gate.tsx';
import { CronEditor } from '../../features/cron/cron-editor.tsx';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function CronEditorPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <CronAvailabilityGate>
                <CronEditor />
            </CronAvailabilityGate>
        </React.Suspense>
    );
}
