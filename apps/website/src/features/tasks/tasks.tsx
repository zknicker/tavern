import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toastManager } from '../../components/ui/toast.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useSearch } from '../../hooks/shell/use-search.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { useTaskCreate } from '../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { TaskNewDialog, type TaskNewDialogSubmit } from './task-new-dialog.tsx';
import {
    filterTasks,
    formatTaskNumber,
    type TaskAssigneeFilter,
    type TaskView,
} from './task-presentation.ts';
import { TasksView } from './tasks-view.tsx';

export function Tasks() {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const tasksQuery = useTaskList();
    const agentsQuery = useAgentList();
    const createMutation = useTaskCreate();
    const { deferredQuery, query, setQuery } = useSearch();
    const [view, setView] = React.useState<TaskView>('all');
    const [assignee, setAssignee] = React.useState<TaskAssigneeFilter>('anyone');
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);

    const tasks = React.useMemo(() => tasksQuery.data?.tasks ?? [], [tasksQuery.data?.tasks]);
    const agents = React.useMemo(
        () =>
            (agentsQuery.data?.agents ?? []).map((agent) => ({
                character: agent.effectiveCharacter,
                id: agent.id,
                name: agent.name,
                primaryColor: agent.effectivePrimaryColor,
            })),
        [agentsQuery.data?.agents]
    );
    const epics = React.useMemo(() => tasks.filter((task) => task.kind === 'epic'), [tasks]);
    const filteredTasks = React.useMemo(
        () => filterTasks({ assignee, query: deferredQuery, tasks, view }),
        [assignee, deferredQuery, tasks, view]
    );
    const assigneeName = React.useCallback(
        (task: TaskRecord) => {
            if (task.assignee?.kind === 'user') {
                return 'You';
            }

            if (task.assignee?.kind === 'agent') {
                const agentId = task.assignee.agentId;

                return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
            }

            return null;
        },
        [agents]
    );

    const openTask = React.useCallback(
        (task: TaskRecord) => {
            navigate(appRoutes.task(task.id));
        },
        [navigate]
    );

    const createTask = React.useCallback(
        async (input: TaskNewDialogSubmit) => {
            const created = await createMutation.mutateAsync({
                assignee: input.assigneeAgentId
                    ? { agentId: input.assigneeAgentId, kind: 'agent' }
                    : null,
                description: input.description,
                epicId: input.epicId,
                kind: input.kind,
                priority: input.priority,
                status: input.status,
                title: input.title,
            });
            setIsCreateOpen(false);
            toastManager.add({
                title: `${formatTaskNumber(created)} created`,
                type: 'success',
            });
        },
        [createMutation]
    );

    return (
        <>
            <TasksView
                actionErrorMessage={null}
                agents={agents}
                assignee={assignee}
                assigneeName={assigneeName}
                connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
                filteredTasks={filteredTasks}
                onAssigneeChange={setAssignee}
                onClearFilters={() => {
                    setView('all');
                    setAssignee('anyone');
                    setQuery('');
                }}
                onCreate={() => {
                    createMutation.reset();
                    setIsCreateOpen(true);
                }}
                onNavigateToSettings={navigateToSettings}
                onOpen={openTask}
                onQueryChange={setQuery}
                onViewChange={setView}
                query={query}
                tasks={tasks}
                view={view}
            />
            <TaskNewDialog
                agents={agents}
                epics={epics}
                errorMessage={createMutation.error?.message ?? null}
                isOpen={isCreateOpen}
                isPending={createMutation.isPending}
                onClose={() => {
                    if (!createMutation.isPending) {
                        setIsCreateOpen(false);
                    }
                }}
                onSubmit={createTask}
            />
        </>
    );
}
