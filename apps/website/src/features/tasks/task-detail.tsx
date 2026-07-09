import { Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import {
    formatCapabilityDisabledReason,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import { useTaskGet } from '../../hooks/tasks/use-task-get.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import {
    useTaskDelete,
    useTaskDispatch,
    useTaskUpdate,
} from '../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { TaskBlockedReason } from './task-blocked-reason.tsx';
import { TaskDependencies } from './task-dependencies.tsx';
import { TaskDispatchField } from './task-dispatch-field.tsx';
import { TaskEditorPane } from './task-editor-pane.tsx';
import { TaskEditorSection, TaskEditorSidebar } from './task-editor-sidebar.tsx';
import { TaskFields } from './task-fields.tsx';
import { formatTaskNumber } from './task-presentation.ts';
import { TaskSchedule } from './task-schedule.tsx';
import { useTaskAgentOptions } from './use-task-agent-options.ts';

export function TaskDetail({ taskId }: { taskId: string }) {
    const navigate = useNavigate();
    const taskQuery = useTaskGet(taskId);
    const tasksQuery = useTaskList();
    const agentsQuery = useAgentList();
    const updateMutation = useTaskUpdate();
    const deleteMutation = useTaskDelete();
    const dispatchMutation = useTaskDispatch();
    const gateway = useCapability('gateway');
    const [dispatchAgentId, setDispatchAgentId] = React.useState<string | null>(null);

    const task = taskQuery.data?.task ?? null;
    const tasks = tasksQuery.data?.tasks ?? [];
    const agents = useTaskAgentOptions(agentsQuery.data?.agents);
    const epics = React.useMemo(
        () => (tasksQuery.data?.tasks ?? []).filter((candidate) => candidate.kind === 'epic'),
        [tasksQuery.data?.tasks]
    );
    const suggestedAgentId =
        dispatchAgentId ??
        (task?.assignee?.kind === 'agent' ? task.assignee.agentId : null) ??
        agents[0]?.id ??
        null;

    const patchTask = React.useCallback(
        (patch: Parameters<typeof updateMutation.mutateAsync>[0]['patch']) => {
            updateMutation.mutateAsync({ patch, taskId }).catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: 'Update failed',
                    type: 'error',
                });
            });
        },
        [taskId, updateMutation]
    );

    const dispatch = React.useCallback(() => {
        if (!suggestedAgentId) {
            return;
        }

        dispatchMutation
            .mutateAsync({ agentId: suggestedAgentId, taskId })
            .then((result) => {
                toastManager.add({
                    description: 'The agent will pick it up in its direct chat.',
                    title: `${formatTaskNumber(result.task)} dispatched`,
                    type: 'success',
                });
            })
            .catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: 'Dispatch failed',
                    type: 'error',
                });
            });
    }, [dispatchMutation, suggestedAgentId, taskId]);

    const deleteTask = React.useCallback(() => {
        deleteMutation
            .mutateAsync({ taskId })
            .then(() => {
                navigate(appRoutes.tasks);
            })
            .catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: 'Delete failed',
                    type: 'error',
                });
            });
    }, [deleteMutation, navigate, taskId]);

    if (!task) {
        if (taskQuery.isPending) {
            return null;
        }

        return (
            <EmptyState
                actionLabel="Back to Tasks"
                description="This task may have been deleted."
                eyebrow="Tasks"
                onAction={() => navigate(appRoutes.tasks)}
                title="Task not found"
            />
        );
    }

    const actions = (
        <div className="flex justify-end">
            <Button
                loading={deleteMutation.isPending}
                onClick={deleteTask}
                size="sm"
                type="button"
                variant="ghost"
            >
                <Icon aria-hidden="true" className="size-4" icon={Trash2} />
                Delete
            </Button>
        </div>
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="px-4 pt-3 lg:hidden">{actions}</div>
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <TaskDetailPane key={task.id} onSave={patchTask} task={task} />
                <TaskEditorSidebar>
                    <div className="max-lg:hidden">{actions}</div>
                    <TaskFields
                        agents={agents}
                        disabled={updateMutation.isPending}
                        epics={epics.filter((epic) => epic.id !== task.id)}
                        onChange={patchTask}
                        showEpic={task.kind === 'task'}
                        value={task}
                    />
                    {task.kind === 'task' ? (
                        <>
                            <Separator />
                            <TaskSchedule
                                disabled={updateMutation.isPending}
                                onChange={(scheduledFor) => patchTask({ scheduledFor })}
                                value={task.scheduledFor}
                            />
                            <Separator />
                            <TaskDependencies
                                disabled={updateMutation.isPending}
                                onChange={(blockedBy) => patchTask({ blockedBy })}
                                onOpenTask={(dependencyId) =>
                                    navigate(appRoutes.task(dependencyId))
                                }
                                task={task}
                                tasks={tasks}
                            />
                        </>
                    ) : null}
                    {task.status === 'blocked' ? (
                        <>
                            <Separator />
                            <TaskBlockedReason
                                disabled={updateMutation.isPending}
                                onChange={(blockedReason) => patchTask({ blockedReason })}
                                value={task.blockedReason}
                            />
                        </>
                    ) : null}
                    <Separator />
                    <TaskDispatchField
                        agents={agents}
                        disabledReason={
                            gateway.healthy ? null : formatCapabilityDisabledReason(gateway)
                        }
                        dispatchAgentId={suggestedAgentId}
                        isDispatching={dispatchMutation.isPending}
                        onDispatch={dispatch}
                        onDispatchAgentChange={setDispatchAgentId}
                    />
                    <Separator />
                    <TaskEditorSection title="Activity">
                        <div className="grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Created</span>
                                <span className="text-foreground">
                                    <RelativeTime value={task.createdAt} />
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Updated</span>
                                <span className="text-foreground">
                                    <RelativeTime value={task.updatedAt} />
                                </span>
                            </div>
                        </div>
                    </TaskEditorSection>
                </TaskEditorSidebar>
            </div>
        </div>
    );
}

function TaskDetailPane({
    onSave,
    task,
}: {
    onSave: (patch: { description?: string | null; title?: string }) => void;
    task: { description: string | null; summary: string | null; title: string };
}) {
    const [title, setTitle] = React.useState(task.title);
    const [description, setDescription] = React.useState(task.description ?? '');

    // Adopt external edits (agent tools, other windows) so a later blur
    // does not save stale text over them.
    React.useEffect(() => {
        setTitle(task.title);
    }, [task.title]);
    React.useEffect(() => {
        setDescription(task.description ?? '');
    }, [task.description]);

    return (
        <TaskEditorPane
            description={description}
            footer={task.summary ? <TaskSummary summary={task.summary} /> : null}
            onDescriptionBlur={() => {
                const trimmed = description.trim();

                if (trimmed !== (task.description ?? '')) {
                    onSave({ description: trimmed ? trimmed : null });
                }
            }}
            onDescriptionChange={setDescription}
            onTitleBlur={() => {
                const trimmed = title.trim();

                if (trimmed && trimmed !== task.title) {
                    onSave({ title: trimmed });
                } else if (!trimmed) {
                    setTitle(task.title);
                }
            }}
            onTitleChange={setTitle}
            title={title}
            titlePlaceholder="Untitled task"
        />
    );
}

// The agent's close-out outcome, written at terminal transitions. Read-only;
// plain text for now (markdown rendering lands in a later phase).
function TaskSummary({ summary }: { summary: string }) {
    return (
        <section className="shrink-0 space-y-2">
            <h2 className="font-medium text-muted-foreground text-sm">Summary</h2>
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2 text-foreground text-sm">
                {summary}
            </div>
        </section>
    );
}
