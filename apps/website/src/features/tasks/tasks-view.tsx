import type { IconSvgElement } from '@hugeicons/react';
import {
    Calendar03Icon,
    CheckListIcon,
    DashedLineCircleIcon,
    Layers01Icon,
    Loading03Icon,
    UserIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { BulkTaskUpdate, BulkTaskUpdateResult } from '../../hooks/tasks/use-task-mutations.ts';
import type { TaskSelection } from '../../hooks/tasks/use-task-selection.ts';
import type { LabelRecord, TaskRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { AgentSelectOption } from '../agents/agent-option-label.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { TaskBulkActions } from './task-bulk-actions.tsx';
import {
    type DispatchQueueSummary,
    groupTasksByStatus,
    type TaskAssigneeFilter,
    type TaskLabelFilter,
    type TaskView,
} from './task-presentation.ts';
import { TasksCalendar } from './tasks-calendar.tsx';
import { TaskStatusGroup } from './tasks-list.tsx';
import { TasksToolbar } from './tasks-toolbar.tsx';

const taskViews: Array<{ icon: IconSvgElement; label: string; value: TaskView }> = [
    { icon: CheckListIcon, label: 'All tasks', value: 'all' },
    { icon: Loading03Icon, label: 'Active', value: 'active' },
    { icon: DashedLineCircleIcon, label: 'Backlog', value: 'backlog' },
    { icon: UserIcon, label: 'My tasks', value: 'mine' },
    { icon: Layers01Icon, label: 'Epics', value: 'epics' },
    { icon: Calendar03Icon, label: 'Calendar', value: 'calendar' },
];

interface TasksViewProps {
    actionErrorMessage: string | null;
    agents: AgentSelectOption[];
    assignee: TaskAssigneeFilter;
    bulkUpdate: (updates: BulkTaskUpdate[]) => Promise<BulkTaskUpdateResult>;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    epics: TaskRecord[];
    filteredTasks: TaskRecord[];
    label: TaskLabelFilter;
    labels: LabelRecord[];
    onAssigneeChange: (assignee: TaskAssigneeFilter) => void;
    onClearFilters: () => void;
    onCreate: () => void;
    onLabelChange: (label: TaskLabelFilter) => void;
    onNavigateToSettings: () => void;
    onOpen: (task: TaskRecord) => void;
    onQueryChange: (query: string) => void;
    onViewChange: (view: TaskView) => void;
    query: string;
    queueSummary: DispatchQueueSummary;
    selectedTasks: TaskRecord[];
    selection: TaskSelection;
    showQueueIndicator: boolean;
    tasks: TaskRecord[];
    view: TaskView;
}

export function TasksView({
    actionErrorMessage,
    agents,
    assignee,
    bulkUpdate,
    connectionState,
    epics,
    filteredTasks,
    label,
    labels,
    onAssigneeChange,
    onClearFilters,
    onCreate,
    onLabelChange,
    onNavigateToSettings,
    onOpen,
    onQueryChange,
    onViewChange,
    query,
    queueSummary,
    selectedTasks,
    selection,
    showQueueIndicator,
    tasks,
    view,
}: TasksViewProps) {
    const tasksById = React.useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

    if (tasks.length === 0 && connectionState !== 'reachable') {
        return (
            <EmptyState
                actionLabel="Open settings"
                description="Tasks appear after Tavern can talk to Tavern Runtime. Connect or repair Tavern Runtime from settings, then your tracked work will show up here."
                eyebrow="Tasks"
                onAction={onNavigateToSettings}
                title="Tasks are waiting on Tavern Runtime."
            />
        );
    }

    const groups = groupTasksByStatus(filteredTasks);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {actionErrorMessage ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{actionErrorMessage}</p>
                </div>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col border-sidebar-border border-r bg-[var(--sidebar)] max-md:hidden">
                    <SidebarGroup>
                        <SidebarGroupLabel>Tasks</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {taskViews.map((taskView) => (
                                    <SidebarMenuItem key={taskView.value}>
                                        <SidebarMenuButton
                                            isActive={taskView.value === view}
                                            onClick={() => onViewChange(taskView.value)}
                                        >
                                            <Icon aria-hidden="true" icon={taskView.icon} />
                                            <span>{taskView.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </aside>

                <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <nav
                        aria-label="Task views"
                        className="flex flex-wrap gap-1 px-2 pt-2 md:hidden"
                    >
                        {taskViews.map((taskView) => {
                            const isActive = taskView.value === view;

                            return (
                                <button
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                        isActive
                                            ? 'bg-active font-medium text-foreground'
                                            : 'text-muted-foreground hover:bg-hover hover:text-foreground'
                                    )}
                                    key={taskView.value}
                                    onClick={() => onViewChange(taskView.value)}
                                    type="button"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 opacity-80"
                                        icon={taskView.icon}
                                    />
                                    {taskView.label}
                                </button>
                            );
                        })}
                    </nav>

                    <TasksToolbar
                        agents={agents}
                        assignee={assignee}
                        label={label}
                        labels={labels}
                        onAssigneeChange={onAssigneeChange}
                        onCreate={onCreate}
                        onLabelChange={onLabelChange}
                        onQueryChange={onQueryChange}
                        query={query}
                        queueSummary={queueSummary}
                        showQueueIndicator={showQueueIndicator}
                    />

                    {view === 'calendar' ? (
                        <TasksCalendar onOpen={onOpen} tasks={filteredTasks} />
                    ) : (
                        <div className="min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
                            {groups.length > 0 ? (
                                <div className="flex flex-col pb-8">
                                    {groups.map((group) => (
                                        <TaskStatusGroup
                                            agents={agents}
                                            isSelected={selection.isSelected}
                                            key={group.status}
                                            onOpen={onOpen}
                                            onToggleSelect={(task, mode) =>
                                                selection.select(task.id, mode)
                                            }
                                            selectionActive={selection.selectionActive}
                                            status={group.status}
                                            tasks={group.tasks}
                                            tasksById={tasksById}
                                        />
                                    ))}
                                </div>
                            ) : tasks.length === 0 ? (
                                <EmptyState
                                    actionLabel="New task"
                                    description="Create a task, or ask an agent to file one from chat. Tasks and epics are shared between you and your agents."
                                    onAction={onCreate}
                                    title="No tasks yet"
                                />
                            ) : (
                                <TasksEmptyResults onClearFilters={onClearFilters} />
                            )}
                        </div>
                    )}

                    {selectedTasks.length > 0 ? (
                        <TaskBulkActions
                            agents={agents}
                            bulkUpdate={bulkUpdate}
                            epics={epics}
                            labels={labels}
                            onClear={selection.clear}
                            selectedTasks={selectedTasks}
                        />
                    ) : null}
                </section>
            </div>
        </div>
    );
}

function TasksEmptyResults({ onClearFilters }: { onClearFilters: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
                No tasks match the current view, filters, or search.
            </p>
            <button
                className="mt-2 text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
                onClick={onClearFilters}
                type="button"
            >
                Clear filters
            </button>
        </div>
    );
}
