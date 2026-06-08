import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card } from '../../components/ui/card.tsx';
import { useCronCreate } from '../../hooks/cron/use-cron-create.ts';
import { useCronDelete } from '../../hooks/cron/use-cron-delete.ts';
import { useCronGet } from '../../hooks/cron/use-cron-get.ts';
import { useCronRun } from '../../hooks/cron/use-cron-run.ts';
import { useCronRuns } from '../../hooks/cron/use-cron-runs.ts';
import { useCronUpdate } from '../../hooks/cron/use-cron-update.ts';
import type { CronGetOutput } from '../../lib/trpc.tsx';
import { CronDeleteDialog } from './cron-delete-dialog.tsx';
import { CronEditorHeader } from './cron-editor-header.tsx';
import { CronEditorPageForm } from './cron-editor-page-form.tsx';
import type { CronFormState } from './cron-form.ts';
import { buildCronCreateInput, buildCronUpdateInput } from './cron-inputs.ts';
import { CronRunsDrawer } from './cron-runs-drawer.tsx';
import { MissingCronJobCard } from './missing-cron-job-card.tsx';

type CronJob = CronGetOutput['job'];

export function shouldRenderCronEditorPageForm(input: {
    isLoading: boolean;
    isNew: boolean;
    job: CronJob | null;
}) {
    return input.isNew || !input.isLoading || input.job !== null;
}

export function CronEditor() {
    const navigate = useNavigate();
    const { jobId } = useParams<{ jobId?: string }>();
    const isNew = !jobId;
    const cronJobQuery = useCronGet(jobId ?? null);
    const createMutation = useCronCreate();
    const deleteMutation = useCronDelete();
    const runMutation = useCronRun();
    const updateMutation = useCronUpdate();
    const job = isNew ? null : (cronJobQuery.data?.job ?? null);
    const cronRunsQuery = useCronRuns(job ? { jobId: job.id, limit: 20 } : null);
    const isMissingJob = !isNew && cronJobQuery.status === 'success' && !job;
    const isPending = createMutation.isPending || updateMutation.isPending;
    const canEdit = !isMissingJob;
    const shouldRenderForm = shouldRenderCronEditorPageForm({
        isLoading: cronJobQuery.isPending,
        isNew,
        job,
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [runsDrawerOpen, setRunsDrawerOpen] = React.useState(false);

    const handleBack = React.useCallback(() => {
        navigate('/dashboard/cron');
    }, [navigate]);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <CronEditorHeader
                canEdit={canEdit}
                canRunActions={Boolean(job)}
                isDeleting={deleteMutation.isPending}
                isNew={isNew}
                isPending={isPending}
                isRunning={runMutation.isPending}
                onDelete={() => {
                    setDeleteDialogOpen(true);
                }}
                onHistory={() => {
                    setRunsDrawerOpen(true);
                }}
                onRun={() => {
                    if (!job) {
                        return;
                    }

                    void runMutation.mutateAsync({
                        jobId: job.id,
                        mode: 'force',
                    });
                }}
            />

            {runMutation.error ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{runMutation.error.message}</p>
                </div>
            ) : null}

            {isMissingJob ? (
                <div className="p-4">
                    <MissingCronJobCard onBack={handleBack} />
                </div>
            ) : shouldRenderForm ? (
                <CronEditorPageForm
                    job={job}
                    onSubmit={async (formState: CronFormState) => {
                        if (job) {
                            await updateMutation.mutateAsync(
                                buildCronUpdateInput(job.id, formState)
                            );
                        } else {
                            await createMutation.mutateAsync(buildCronCreateInput(formState));
                        }

                        navigate('/dashboard/cron');
                    }}
                />
            ) : (
                <div className="p-4">
                    <Card className="overflow-hidden">
                        <BadgeDivider
                            className="px-4 pt-5 pb-4"
                            subtext="Loading the selected automation."
                        >
                            Configuration
                        </BadgeDivider>
                        <div className="p-4 text-muted-foreground text-sm">
                            Loading automation...
                        </div>
                    </Card>
                </div>
            )}

            <CronRunsDrawer
                isOpen={runsDrawerOpen}
                isPending={cronRunsQuery.isPending}
                jobName={job?.name ?? null}
                onClose={() => {
                    setRunsDrawerOpen(false);
                }}
                runs={cronRunsQuery.data?.runs ?? []}
            />

            <CronDeleteDialog
                errorMessage={deleteMutation.error?.message ?? null}
                isOpen={deleteDialogOpen}
                isPending={deleteMutation.isPending}
                jobName={job?.name ?? null}
                onClose={() => {
                    if (deleteMutation.isPending) {
                        return;
                    }

                    deleteMutation.reset();
                    setDeleteDialogOpen(false);
                }}
                onConfirm={async () => {
                    if (!job) {
                        return;
                    }

                    await deleteMutation.mutateAsync({ jobId: job.id });
                    navigate('/dashboard/cron');
                }}
            />
        </div>
    );
}
