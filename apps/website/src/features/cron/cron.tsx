import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useCronDelete } from '../../hooks/cron/use-cron-delete.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useCronRun } from '../../hooks/cron/use-cron-run.ts';
import { useCronRuns } from '../../hooks/cron/use-cron-runs.ts';
import { useCronToggle } from '../../hooks/cron/use-cron-toggle.ts';
import { useSearch } from '../../hooks/shell/use-search.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { CronDeleteDialog } from './cron-delete-dialog.tsx';
import { buildCronList, type CronListItem } from './cron-list-data.ts';
import { CronRunsDrawer } from './cron-runs-drawer.tsx';
import { CronView } from './cron-view.tsx';
import { type CronFilter, filterCronJobs } from './filter-cron-jobs.ts';

function getCronMutationErrorMessage(error: { message?: string } | null | undefined) {
    return error?.message ?? null;
}

export function Cron() {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const cronJobsQuery = useCronList();
    const deleteMutation = useCronDelete();
    const toggleMutation = useCronToggle();
    const runMutation = useCronRun();
    const { deferredQuery, query, setQuery } = useSearch();
    const relativeNow = useRelativeNow();
    const cronJobs = React.useMemo(
        () => buildCronList(cronJobsQuery.data?.jobs ?? [], [], relativeNow),
        [cronJobsQuery.data?.jobs, relativeNow]
    );
    const [filter, setFilter] = React.useState<CronFilter>('all');
    const [deleteJob, setDeleteJob] = React.useState<CronListItem | null>(null);
    const [historyJob, setHistoryJob] = React.useState<CronListItem | null>(null);
    const cronRunsQuery = useCronRuns(historyJob ? { jobId: historyJob.id, limit: 20 } : null);
    const totalJobs = cronJobs.length;
    const enabledJobs = React.useMemo(
        () => cronJobs.filter((job) => job.enabled).length,
        [cronJobs]
    );
    const pausedJobs = totalJobs - enabledJobs;
    const filteredJobs = React.useMemo(
        () =>
            filterCronJobs({
                cronJobs,
                filter,
                query: deferredQuery,
            }),
        [cronJobs, deferredQuery, filter]
    );
    const actionErrorMessage =
        getCronMutationErrorMessage(deleteMutation.error) ??
        getCronMutationErrorMessage(toggleMutation.error) ??
        getCronMutationErrorMessage(runMutation.error);
    const activeDeleteJobId = deleteMutation.isPending
        ? (deleteMutation.variables?.jobId ?? null)
        : null;
    const activeRunJobId = runMutation.isPending ? (runMutation.variables?.jobId ?? null) : null;
    const activeToggleJobId = toggleMutation.isPending
        ? (toggleMutation.variables?.jobId ?? null)
        : null;
    const isMutating =
        deleteMutation.isPending || toggleMutation.isPending || runMutation.isPending;
    const openCreatePage = React.useCallback(() => {
        navigate(appRoutes.newAutomation);
    }, [navigate]);

    const editJob = React.useCallback(
        (job: CronListItem) => {
            navigate(appRoutes.editAutomation(job.id));
        },
        [navigate]
    );

    return (
        <>
            <CronView
                actionErrorMessage={actionErrorMessage}
                activeDeleteJobId={activeDeleteJobId}
                activeRunJobId={activeRunJobId}
                activeToggleJobId={activeToggleJobId}
                canEdit={true}
                connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
                cronJobs={cronJobs}
                enabledJobs={enabledJobs}
                filter={filter}
                filteredJobs={filteredJobs}
                isMutating={isMutating}
                onClearFilters={() => {
                    setFilter('all');
                    setQuery('');
                }}
                onCreate={openCreatePage}
                onDelete={async (job) => {
                    setDeleteJob(job);
                }}
                onEdit={editJob}
                onFilterChange={setFilter}
                onHistory={setHistoryJob}
                onNavigateToSettings={navigateToSettings}
                onQueryChange={setQuery}
                onRun={async (job) => {
                    await runMutation.mutateAsync({
                        jobId: job.id,
                        mode: 'enqueue',
                    });
                }}
                onToggle={async (job, enabled) => {
                    await toggleMutation.mutateAsync({
                        enabled,
                        jobId: job.id,
                    });
                }}
                pausedJobs={pausedJobs}
                query={query}
                totalJobs={totalJobs}
            />
            <CronRunsDrawer
                deliveryDestinationLabel={null}
                isOpen={historyJob !== null}
                isPending={cronRunsQuery.isPending}
                jobName={historyJob?.name ?? null}
                onClose={() => {
                    setHistoryJob(null);
                }}
                runs={cronRunsQuery.data?.runs ?? []}
            />
            <CronDeleteDialog
                errorMessage={deleteMutation.error?.message ?? null}
                isOpen={deleteJob !== null}
                isPending={deleteMutation.isPending}
                jobName={deleteJob?.name ?? null}
                onClose={() => {
                    if (deleteMutation.isPending) {
                        return;
                    }

                    deleteMutation.reset();
                    setDeleteJob(null);
                }}
                onConfirm={async () => {
                    if (!deleteJob) {
                        return;
                    }

                    await deleteMutation.mutateAsync({ jobId: deleteJob.id });
                    setDeleteJob(null);
                }}
            />
        </>
    );
}
