import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import * as React from 'react';
import { useJobListSuspense } from '../../hooks/jobs/use-job-list.ts';
import { useJobsEvents } from '../../hooks/jobs/use-jobs-events.ts';
import { type JobsListOutput, trpc } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { JobHistoryDrawer } from './job-history-drawer.tsx';
import { JobsErrorBoundary } from './jobs-error-boundary.tsx';
import { JobsPageSkeleton } from './jobs-page-skeleton.tsx';
import { JobsSummarySection } from './jobs-summary-section.tsx';

export function Jobs() {
    const utils = trpc.useUtils();
    const { reset } = useQueryErrorResetBoundary();

    useJobsEvents();

    return (
        <JobsErrorBoundary
            onRetry={() => {
                reset();
                utils.jobs.list.invalidate().catch(() => undefined);
                utils.jobs.get.invalidate(undefined, { exact: false }).catch(() => undefined);
            }}
        >
            <React.Suspense fallback={<JobsPageSkeleton />}>
                <JobsContent />
            </React.Suspense>
        </JobsErrorBoundary>
    );
}

function JobsContent() {
    const [jobsResponse] = useJobListSuspense();
    const [selectedJobSlug, setSelectedJobSlug] = React.useState<
        JobsListOutput['jobs'][number]['slug'] | null
    >(null);
    const jobs = jobsResponse.jobs;

    if (jobs.length === 0) {
        return (
            <EmptyState
                description="Scheduled provider imports and maintenance tasks will appear here after they are registered."
                eyebrow="Jobs"
                title="No jobs are registered yet."
            />
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <JobsSummarySection jobs={jobs} onSelectJob={setSelectedJobSlug} />
            <JobHistoryDrawer
                onClose={() => setSelectedJobSlug(null)}
                selectedJobSlug={selectedJobSlug}
            />
        </div>
    );
}
