import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useCapability } from '../../hooks/connections/use-capability.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useLabelList } from '../../hooks/labels/use-label-list.ts';
import { useSearch } from '../../hooks/shell/use-search.ts';
import { useAutoDispatchSettings } from '../../hooks/tasks/use-auto-dispatch-settings.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { useTaskBulkUpdate } from '../../hooks/tasks/use-task-mutations.ts';
import { useTaskSelection } from '../../hooks/tasks/use-task-selection.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { useAgentSelectOptions } from '../agents/use-agent-select-options.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import {
    filterTasks,
    summarizeDispatchQueue,
    type TaskAssigneeFilter,
    type TaskLabelFilter,
    type TaskView,
} from './task-presentation.ts';
import { TasksView } from './tasks-view.tsx';

export function Tasks({ conversationId, embedded = false }: TasksProps = {}) {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const tasksQuery = useTaskList();
    const agentsQuery = useAgentList();
    const labelsQuery = useLabelList();
    const autoDispatch = useCapability('autoDispatch');
    const autoDispatchSettings = useAutoDispatchSettings();
    const bulkUpdate = useTaskBulkUpdate();
    // The shell search store only tracks full-page routes; the embedded
    // conversation tab owns a local query so its toolbar search works.
    const shellSearch = useSearch();
    const [embeddedQuery, setEmbeddedQuery] = React.useState('');
    const query = embedded ? embeddedQuery : shellSearch.query;
    const deferredQuery = embedded ? embeddedQuery : shellSearch.deferredQuery;
    const setQuery = embedded ? setEmbeddedQuery : shellSearch.setQuery;
    const [selectedView, setView] = React.useState<TaskView>('all');
    const [assignee, setAssignee] = React.useState<TaskAssigneeFilter>('anyone');
    const [label, setLabel] = React.useState<TaskLabelFilter>('all');
    const view: TaskView = embedded ? 'all' : selectedView;

    const tasks = React.useMemo(() => tasksQuery.data?.tasks ?? [], [tasksQuery.data?.tasks]);
    // The unfiltered base the empty states reason about: a conversation tab
    // is scoped to its own tasks, never the whole workspace.
    const scopedTasks = React.useMemo(
        () =>
            conversationId ? tasks.filter((task) => task.originChatId === conversationId) : tasks,
        [conversationId, tasks]
    );

    const agents = useAgentSelectOptions(agentsQuery.data?.agents);
    const labels = React.useMemo(() => labelsQuery.data?.labels ?? [], [labelsQuery.data?.labels]);
    const tasksById = React.useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
    const filteredTasks = React.useMemo(
        () =>
            filterTasks({
                assignee,
                conversationId,
                label,
                query: deferredQuery,
                tasks,
                view,
            }),
        [assignee, conversationId, deferredQuery, label, tasks, view]
    );
    const epics = React.useMemo(() => tasks.filter((task) => task.kind === 'epic'), [tasks]);
    const orderedIds = React.useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks]);
    const selection = useTaskSelection(orderedIds);

    const queueSummary = React.useMemo(
        () => summarizeDispatchQueue(scopedTasks, tasksById),
        [scopedTasks, tasksById]
    );
    const showQueueIndicator =
        autoDispatch.healthy && autoDispatchSettings.settings.autoDispatchEnabled;

    const selectedTasks = React.useMemo(
        () => filteredTasks.filter((task) => selection.selectedIds.has(task.id)),
        [filteredTasks, selection.selectedIds]
    );

    const openTask = React.useCallback(
        (task: TaskRecord) => {
            navigate(appRoutes.task(task.id));
        },
        [navigate]
    );

    const { clear: clearSelection, selectionActive } = selection;

    // Escape drops a multi-selection, matching platform list conventions.
    React.useEffect(() => {
        if (!selectionActive) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                clearSelection();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [clearSelection, selectionActive]);

    return (
        <TasksView
            actionErrorMessage={null}
            agents={agents}
            assignee={assignee}
            bulkUpdate={bulkUpdate}
            connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
            embedded={embedded}
            epics={epics}
            filteredTasks={filteredTasks}
            hasTaskData={tasksQuery.data !== undefined}
            label={label}
            labels={labels}
            onAssigneeChange={setAssignee}
            onClearFilters={() => {
                setView('all');
                setAssignee('anyone');
                setLabel('all');
                setQuery('');
            }}
            onCreate={() => {
                navigate(appRoutes.newTask);
            }}
            onLabelChange={setLabel}
            onNavigateToSettings={navigateToSettings}
            onOpen={openTask}
            onQueryChange={setQuery}
            onViewChange={setView}
            query={query}
            queueSummary={queueSummary}
            selectedTasks={selectedTasks}
            selection={selection}
            showQueueIndicator={showQueueIndicator}
            tasks={scopedTasks}
            tasksById={tasksById}
            view={view}
        />
    );
}

interface TasksProps {
    conversationId?: string;
    embedded?: boolean;
}
