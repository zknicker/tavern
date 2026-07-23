import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useLabelList } from '../../hooks/labels/use-label-list.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { useTaskBulkUpdate } from '../../hooks/tasks/use-task-mutations.ts';
import { useTaskSelection } from '../../hooks/tasks/use-task-selection.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { useAgentSelectOptions } from '../agents/use-agent-select-options.ts';
import { buildChatList } from '../chats/chat-list-data.ts';
import { NewTaskDialog } from './new-task-dialog.tsx';
import {
    filterTasks,
    type TaskAssigneeFilter,
    type TaskLabelFilter,
    type TaskRecord,
    type TaskView,
    toTaskRecord,
} from './task-presentation.ts';
import { TasksView, type TaskViewMode } from './tasks-view.tsx';

const viewModeStorageKey = 'grotto.tasks.view-mode';

export function TasksSurface({ chatId }: { chatId?: string } = {}) {
    const navigate = useNavigate();
    const tasksQuery = useTaskList();
    const agentsQuery = useAgentList();
    const labelsQuery = useLabelList();
    const chatsQuery = useChatList();
    const bulkUpdate = useTaskBulkUpdate();

    const [composeOpen, setComposeOpen] = React.useState(false);
    const [selectedView, setView] = React.useState<TaskView>('all');
    const [assignee, setAssignee] = React.useState<TaskAssigneeFilter>('anyone');
    const [label, setLabel] = React.useState<TaskLabelFilter>('all');
    const [query, setQuery] = React.useState('');
    const [mode, setMode] = React.useState<TaskViewMode>(() =>
        typeof window !== 'undefined' && window.localStorage.getItem(viewModeStorageKey) === 'list'
            ? 'list'
            : 'board'
    );
    const changeMode = React.useCallback((next: TaskViewMode) => {
        setMode(next);
        window.localStorage.setItem(viewModeStorageKey, next);
    }, []);
    // The conversation Tasks tab is always the flat "all" view scoped to its
    // own tasks; the global page owns the view switcher.
    const view: TaskView = chatId ? 'all' : selectedView;

    const tasks = React.useMemo<TaskRecord[]>(
        () => (tasksQuery.data?.tasks ?? []).map(toTaskRecord),
        [tasksQuery.data?.tasks]
    );
    const scopedTasks = React.useMemo(
        () => (chatId ? tasks.filter((task) => task.originChatId === chatId) : tasks),
        [chatId, tasks]
    );

    const agents = useAgentSelectOptions(agentsQuery.data?.agents);
    const labels = React.useMemo(() => labelsQuery.data?.labels ?? [], [labelsQuery.data?.labels]);
    const chats = React.useMemo(
        () =>
            buildChatList(chatsQuery.data).filter(
                (chat) => chat.conversationKind === 'channel' || chat.conversationKind === 'direct'
            ),
        [chatsQuery.data]
    );

    const filteredTasks = React.useMemo(
        () =>
            filterTasks({
                assignee,
                conversationId: chatId,
                label,
                query,
                tasks,
                view,
            }),
        [assignee, chatId, label, query, tasks, view]
    );
    const orderedIds = React.useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks]);
    const selection = useTaskSelection(orderedIds);
    const selectedTasks = React.useMemo(
        () => filteredTasks.filter((task) => selection.isSelected(task.id)),
        [filteredTasks, selection]
    );

    // Opening a task jumps to its origin message's conversation — the task IS
    // that message, and its thread is the work surface (D8).
    const openTask = React.useCallback(
        (task: TaskRecord) => {
            navigate(appRoutes.chat(task.originChatId));
        },
        [navigate]
    );

    const { clear: clearSelection, selectionActive } = selection;
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
        <>
            <TasksView
                agents={agents}
                assignee={assignee}
                bulkUpdate={bulkUpdate}
                embedded={Boolean(chatId)}
                filteredTasks={filteredTasks}
                label={label}
                labels={labels}
                mode={mode}
                onAssigneeChange={setAssignee}
                onClearFilters={() => {
                    setView('all');
                    setAssignee('anyone');
                    setLabel('all');
                    setQuery('');
                }}
                onCreate={() => setComposeOpen(true)}
                onLabelChange={setLabel}
                onModeChange={changeMode}
                onOpen={openTask}
                onQueryChange={setQuery}
                onViewChange={setView}
                query={query}
                selectedTasks={selectedTasks}
                selection={selection}
                tasks={scopedTasks}
                view={view}
            />
            <NewTaskDialog
                agents={agents}
                chats={chats.map((chat) => ({ id: chat.id, label: chat.title }))}
                defaultChatId={chatId}
                onOpenChange={setComposeOpen}
                open={composeOpen}
            />
        </>
    );
}
