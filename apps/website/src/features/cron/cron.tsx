import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
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
import { useAgentSelectOptions } from '../agents/use-agent-select-options.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { type AutomationsSelection, defaultAutomationsSelection } from './automations-selection.ts';
import { CronDeleteDialog } from './cron-delete-dialog.tsx';
import { buildCronList, type CronListItem } from './cron-list-data.ts';
import { CronRunsDrawer } from './cron-runs-drawer.tsx';
import { CronView } from './cron-view.tsx';
import { filterCronJobs } from './filter-cron-jobs.ts';

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
    const [selection, setSelection] = React.useState<AutomationsSelection>(
        defaultAutomationsSelection
    );
    const [deleteJob, setDeleteJob] = React.useState<CronListItem | null>(null);
    const [historyJob, setHistoryJob] = React.useState<CronListItem | null>(null);
    const cronRunsQuery = useCronRuns(historyJob ? { jobId: historyJob.id, limit: 20 } : null);
    const allRunsQuery = useCronRuns({ limit: 50 });
    const allRuns = React.useMemo(() => allRunsQuery.data?.runs ?? [], [allRunsQuery.data?.runs]);
    const agentsQuery = useAgentList();
    const agentOptions = useAgentSelectOptions(agentsQuery.data?.agents);
    const totalJobs = cronJobs.length;
    const enabledJobs = React.useMemo(
        () => cronJobs.filter((job) => job.enabled).length,
        [cronJobs]
    );
    const pausedJobs = totalJobs - enabledJobs;
    const jobsById = React.useMemo(() => new Map(cronJobs.map((job) => [job.id, job])), [cronJobs]);
    const counts = React.useMemo(
        () => ({
            active: enabledJobs,
            failures: allRuns.filter((run) => run.status === 'error').length,
            paused: pausedJobs,
            total: totalJobs,
        }),
        [allRuns, enabledJobs, pausedJobs, totalJobs]
    );
    const sidebarAgents = React.useMemo(
        () =>
            agentOptions
                .map((agent) => ({
                    ...agent,
                    jobCount: cronJobs.filter((job) => job.channelId === agent.id).length,
                }))
                .filter((agent) => agent.jobCount > 0),
        [agentOptions, cronJobs]
    );
    const filteredJobs = React.useMemo(() => {
        const scopedJobs =
            selection.kind === 'agent'
                ? cronJobs.filter((job) => job.channelId === selection.agentId)
                : cronJobs;

        return filterCronJobs({
            cronJobs: scopedJobs,
            filter: selection.kind === 'filter' ? selection.filter : 'all',
            query: deferredQuery,
        });
    }, [cronJobs, deferredQuery, selection]);
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

    const addSuggested = React.useCallback(
        (suggestedAutomationId: string) => {
            navigate(appRoutes.newAutomation, { state: { suggestedAutomationId } });
        },
        [navigate]
    );

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
                counts={counts}
                cronJobs={cronJobs}
                filteredJobs={filteredJobs}
                isMutating={isMutating}
                jobsById={jobsById}
                onAddSuggested={addSuggested}
                onClearFilters={() => {
                    setSelection(defaultAutomationsSelection);
                    setQuery('');
                }}
                onCreate={openCreatePage}
                onDelete={async (job) => {
                    setDeleteJob(job);
                }}
                onEdit={editJob}
                onHistory={setHistoryJob}
                onNavigateToSettings={navigateToSettings}
                onQueryChange={setQuery}
                onRun={async (job) => {
                    await runMutation.mutateAsync({
                        jobId: job.id,
                        mode: 'enqueue',
                    });
                }}
                onRunSelect={(run) => {
                    const job = jobsById.get(run.jobId);

                    if (job) {
                        setHistoryJob(job);
                    }
                }}
                onSelectionChange={setSelection}
                onToggle={async (job, enabled) => {
                    await toggleMutation.mutateAsync({
                        enabled,
                        jobId: job.id,
                    });
                }}
                query={query}
                runs={allRuns}
                runsPending={allRunsQuery.isPending}
                selection={selection}
                sidebarAgents={sidebarAgents}
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
