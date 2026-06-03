import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { useAgentListSuspense } from '../../hooks/agents/use-agent-list.ts';
import { useCapability } from '../../hooks/connections/use-capability.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useCronDelete } from '../../hooks/cron/use-cron-delete.ts';
import { useCronList } from '../../hooks/cron/use-cron-list.ts';
import { useCronRun } from '../../hooks/cron/use-cron-run.ts';
import { useCronToggle } from '../../hooks/cron/use-cron-toggle.ts';
import { useSearch } from '../../hooks/dashboard/use-search.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { CronDeleteDialog } from './cron-delete-dialog.tsx';
import { buildCronList, type CronListItem } from './cron-list-data.ts';
import { CronView } from './cron-view.tsx';
import { type CronFilter, filterCronJobs } from './filter-cron-jobs.ts';

function getCronMutationErrorMessage(error: { message?: string } | null | undefined) {
    return error?.message ?? null;
}

export function Cron() {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const [agents] = useAgentListSuspense();
    const avatarDirectory = useAgentAvatarDirectory(agents.agents);
    const runtimeConnection = useRuntimeConnection();
    const cronCapability = useCapability('cron');
    const cronJobsQuery = useCronList();
    const deleteMutation = useCronDelete();
    const toggleMutation = useCronToggle();
    const runMutation = useCronRun();
    const { deferredQuery, query, setQuery } = useSearch();
    const cronJobs = React.useMemo(
        () => buildCronList(cronJobsQuery.data?.jobs ?? []),
        [cronJobsQuery.data?.jobs]
    );
    const [filter, setFilter] = React.useState<CronFilter>('all');
    const [deleteJob, setDeleteJob] = React.useState<CronListItem | null>(null);
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
        navigate('/dashboard/cron/new');
    }, [navigate]);

    const editJob = React.useCallback(
        (job: CronListItem) => {
            navigate(`/dashboard/cron/edit/${encodeURIComponent(job.id)}`);
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
                avatarDirectory={avatarDirectory}
                canEdit={cronCapability.healthy}
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
                onNavigateToSettings={navigateToSettings}
                onQueryChange={setQuery}
                onRun={async (job) => {
                    await runMutation.mutateAsync({
                        jobId: job.id,
                        mode: 'force',
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
