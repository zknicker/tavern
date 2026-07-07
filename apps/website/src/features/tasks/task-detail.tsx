import { Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShellContentHeader } from '../../components/ui/app-shell.tsx';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
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
import { TaskContentEditor } from './task-content-editor.tsx';
import { formatTaskNumber } from './task-presentation.ts';
import { TaskPropertiesPanel } from './task-properties-panel.tsx';

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
    const agents = React.useMemo(
        () =>
            (agentsQuery.data?.agents ?? []).map((agent) => ({
                id: agent.id,
                name: agent.name,
            })),
        [agentsQuery.data?.agents]
    );
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

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <AppShellContentHeader>
                <Breadcrumb aria-label="Task breadcrumb" className="flex-1">
                    <BreadcrumbList className="min-w-0 flex-nowrap">
                        <BreadcrumbItem>
                            <BreadcrumbLink render={<Link to={appRoutes.tasks} />}>
                                Tasks
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="min-w-0 truncate">
                                {formatTaskNumber(task)}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <Button
                    className="ml-auto shrink-0"
                    loading={deleteMutation.isPending}
                    onClick={deleteTask}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <Icon aria-hidden="true" className="size-4" icon={Trash2} />
                    Delete
                </Button>
            </AppShellContentHeader>

            <ScrollArea className="flex-1">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 lg:flex-row">
                    <TaskContentEditor
                        description={task.description}
                        isSaving={updateMutation.isPending}
                        key={task.id}
                        onSaveDescription={(description) => patchTask({ description })}
                        onSaveTitle={(title) => patchTask({ title })}
                        title={task.title}
                    />
                    <TaskPropertiesPanel
                        agents={agents}
                        dispatchAgentId={suggestedAgentId}
                        dispatchDisabledReason={
                            gateway.healthy ? null : formatCapabilityDisabledReason(gateway)
                        }
                        epics={epics.filter((epic) => epic.id !== task.id)}
                        isDispatching={dispatchMutation.isPending}
                        isSaving={updateMutation.isPending}
                        onAssigneeChange={(assignee) => patchTask({ assignee })}
                        onDispatch={dispatch}
                        onDispatchAgentChange={setDispatchAgentId}
                        onEpicChange={(epicId) => patchTask({ epicId })}
                        onLabelsChange={(labels) => patchTask({ labels })}
                        onPriorityChange={(priority) => patchTask({ priority })}
                        onStatusChange={(status) => patchTask({ status })}
                        task={task}
                    />
                </div>
            </ScrollArea>
        </div>
    );
}
