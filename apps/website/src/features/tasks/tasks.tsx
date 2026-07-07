import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useSearch } from '../../hooks/shell/use-search.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { filterTasks, type TaskAssigneeFilter, type TaskView } from './task-presentation.ts';
import { TasksView } from './tasks-view.tsx';
import { useTaskAgentOptions } from './use-task-agent-options.ts';

export function Tasks() {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const tasksQuery = useTaskList();
    const agentsQuery = useAgentList();
    const { deferredQuery, query, setQuery } = useSearch();
    const [view, setView] = React.useState<TaskView>('all');
    const [assignee, setAssignee] = React.useState<TaskAssigneeFilter>('anyone');

    const tasks = React.useMemo(() => tasksQuery.data?.tasks ?? [], [tasksQuery.data?.tasks]);
    const agents = useTaskAgentOptions(agentsQuery.data?.agents);
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

    return (
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
                navigate(appRoutes.newTask);
            }}
            onNavigateToSettings={navigateToSettings}
            onOpen={openTask}
            onQueryChange={setQuery}
            onViewChange={setView}
            query={query}
            tasks={tasks}
            view={view}
        />
    );
}
