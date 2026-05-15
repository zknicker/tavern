import * as React from 'react';
import { CronEditor } from '../../features/cron/cron-editor.tsx';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function CronEditorPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <CronEditor />
        </React.Suspense>
    );
}
