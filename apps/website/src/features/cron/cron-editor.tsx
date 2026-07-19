import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { useCronCreate } from '../../hooks/cron/use-cron-create.ts';
import { useCronDelete } from '../../hooks/cron/use-cron-delete.ts';
import { useCronDeliveryTargets } from '../../hooks/cron/use-cron-delivery-targets.ts';
import { useCronGet } from '../../hooks/cron/use-cron-get.ts';
import { useCronRun } from '../../hooks/cron/use-cron-run.ts';
import { useCronRuns } from '../../hooks/cron/use-cron-runs.ts';
import { useCronUpdate } from '../../hooks/cron/use-cron-update.ts';
import { useOptimisticCronRuns } from '../../hooks/cron/use-optimistic-cron-runs.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import type { CronDeliveryTargetsOutput, CronGetOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { CronDeleteDialog } from './cron-delete-dialog.tsx';
import { CronEditorActions } from './cron-editor-actions.tsx';
import { CronEditorPageForm } from './cron-editor-page-form.tsx';
import type { CronFormState } from './cron-form.ts';
import { buildCronCreateInput, buildCronUpdateInput } from './cron-inputs.ts';
import { CronRunDetailDrawer } from './cron-run-detail-drawer.tsx';
import { MissingCronJobCard } from './missing-cron-job-card.tsx';
import { getSuggestedAutomation } from './suggested-automations.ts';

type CronJob = CronGetOutput['job'];
type CronDeliveryTarget = CronDeliveryTargetsOutput['targets'][number];
type CronEditorSkeletonTitleWidth = 'lg' | 'md' | 'sm';

const cronEditorSkeletonLineIds = ['line-1', 'line-2', 'line-3'];
const cronEditorSkeletonTitleClassName: Record<CronEditorSkeletonTitleWidth, string> = {
    lg: 'w-20',
    md: 'w-18',
    sm: 'w-16',
};

export function shouldRenderCronEditorPageForm(input: {
    isLoading: boolean;
    isNew: boolean;
    job: CronJob | null;
}) {
    return input.isNew || !input.isLoading || input.job !== null;
}

export function CronEditor() {
    const navigate = useNavigate();
    const location = useLocation();
    const { jobId } = useParams<{ jobId?: string }>();
    const isNew = !jobId;
    // Suggested-automation prefill: the catalog card navigates here with the
    // suggestion id in router state; the template only applies to creates.
    const suggestedId =
        isNew &&
        location.state &&
        typeof location.state === 'object' &&
        'suggestedAutomationId' in location.state &&
        typeof location.state.suggestedAutomationId === 'string'
            ? location.state.suggestedAutomationId
            : null;
    const suggested = suggestedId ? getSuggestedAutomation(suggestedId) : null;
    const cronJobQuery = useCronGet(jobId ?? null);
    const createMutation = useCronCreate();
    const deleteMutation = useCronDelete();
    const runMutation = useCronRun();
    const updateMutation = useCronUpdate();
    const job = isNew ? null : (cronJobQuery.data?.job ?? null);
    const cronRunsQuery = useCronRuns(job ? { jobId: job.id, limit: 10 } : null);
    const deliveryTargetsQuery = useCronDeliveryTargets(job?.agentId ?? null);
    const deliveryDestinationLabel = getCronDeliveryDestinationLabel(
        job,
        deliveryTargetsQuery.data?.targets ?? []
    );
    const optimisticCronRuns = useOptimisticCronRuns(job, cronRunsQuery.data?.runs ?? []);
    const isMissingJob = !isNew && cronJobQuery.status === 'success' && !job;
    const isPending = createMutation.isPending || updateMutation.isPending;
    const canEdit = !isMissingJob;
    const shouldRenderForm = shouldRenderCronEditorPageForm({
        isLoading: cronJobQuery.isPending,
        isNew,
        job,
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
    const selectedRun = optimisticCronRuns.runs.find((run) => run.id === selectedRunId) ?? null;
    const isLoadingEditor = !(shouldRenderForm || isMissingJob);

    const handleBack = React.useCallback(() => {
        navigate(appRoutes.automations);
    }, [navigate]);

    const editorActions = (
        <CronEditorActions
            canEdit={canEdit && !isLoadingEditor}
            canRunActions={Boolean(job)}
            isDeleting={deleteMutation.isPending}
            isNew={isNew}
            isPending={isPending}
            isRunning={runMutation.isPending}
            onDelete={() => {
                setDeleteDialogOpen(true);
            }}
            onRun={() => {
                if (!job) {
                    return;
                }

                const optimisticRunId = optimisticCronRuns.recordManualRun();

                void runMutation
                    .mutateAsync({
                        jobId: job.id,
                        mode: 'enqueue',
                    })
                    .catch(() => {
                        optimisticCronRuns.markManualRunFailed(optimisticRunId);
                    });
            }}
        />
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {isMissingJob ? null : <div className="px-4 pt-3 lg:hidden">{editorActions}</div>}

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
                    actions={editorActions}
                    isRunsPending={cronRunsQuery.isPending}
                    job={job}
                    onRunSelect={(run) => {
                        setSelectedRunId(run.id);
                    }}
                    onSubmit={async (formState: CronFormState) => {
                        if (job) {
                            await updateMutation.mutateAsync(
                                buildCronUpdateInput(job.id, formState)
                            );
                        } else {
                            await createMutation.mutateAsync(buildCronCreateInput(formState));
                        }

                        navigate(appRoutes.automations);
                    }}
                    runs={optimisticCronRuns.runs}
                    template={suggested?.template}
                    templateId={suggested?.id}
                />
            ) : (
                <CronEditorSkeleton />
            )}

            <CronRunDetailDrawer
                deliveryDestinationLabel={deliveryDestinationLabel}
                jobName={job?.name ?? null}
                onClose={() => {
                    setSelectedRunId(null);
                }}
                run={selectedRun}
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
                    navigate(appRoutes.automations);
                }}
            />
        </div>
    );
}

function CronEditorSkeleton() {
    return (
        <div aria-busy="true" className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <span className="sr-only">Loading automation editor</span>
            <section className="min-w-0 flex-1">
                <div className="mx-auto flex h-full min-h-[42rem] w-full max-w-4xl flex-col gap-6 px-6 pt-3 pb-8 lg:px-10">
                    <div className="flex shrink-0 flex-col gap-2 pt-1">
                        <Skeleton className="h-9 w-80 max-w-full rounded-md" />
                        <Skeleton className="h-6 w-52 max-w-full rounded-md" />
                    </div>

                    <div className="min-h-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-16 rounded-md" />
                        <div className="h-full min-h-[28rem] rounded-lg border border-border/70 p-4">
                            <Skeleton className="h-4 w-full rounded-md" />
                            <Skeleton className="mt-3 h-4 w-4/5 rounded-md" />
                            <Skeleton className="mt-3 h-4 w-3/5 rounded-md" />
                        </div>
                    </div>
                </div>
            </section>

            <aside className="relative w-full border-border/70 border-t lg:w-[22rem] lg:border-t-0 lg:border-l-0 lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-px lg:before:bg-gradient-to-t lg:before:from-border/70 lg:before:via-60% lg:before:via-border/70 lg:before:to-transparent lg:before:content-['']">
                <div className="flex flex-col gap-4 px-4 pt-7 pb-4">
                    <CronEditorSkeletonSection lineCount={3} titleWidth="sm" />
                    <Skeleton className="h-px w-full rounded-none" />
                    <CronEditorSkeletonSection lineCount={2} titleWidth="lg" />
                    <Skeleton className="h-px w-full rounded-none" />
                    <CronEditorSkeletonSection lineCount={3} titleWidth="md" />
                    <Skeleton className="h-px w-full rounded-none" />
                    <CronEditorSkeletonSection lineCount={2} titleWidth="sm" />
                </div>
            </aside>
        </div>
    );
}

function CronEditorSkeletonSection({
    lineCount,
    titleWidth,
}: {
    lineCount: number;
    titleWidth: CronEditorSkeletonTitleWidth;
}) {
    return (
        <section className="space-y-3">
            <Skeleton
                className={cn('h-4 rounded-md', cronEditorSkeletonTitleClassName[titleWidth])}
            />
            <div className="space-y-2">
                {cronEditorSkeletonLineIds.slice(0, lineCount).map((id) => (
                    <div className="flex items-center justify-between gap-4" key={id}>
                        <Skeleton className="h-4 w-20 rounded-md" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                ))}
            </div>
        </section>
    );
}

function getCronDeliveryDestinationLabel(
    job: CronJob | null,
    targets: CronDeliveryTarget[]
): string | null {
    const deliveryChatId = job?.delivery?.chatId.trim();
    if (!deliveryChatId) {
        return null;
    }

    return targets.find((target) => target.chatId === deliveryChatId)?.label ?? deliveryChatId;
}
