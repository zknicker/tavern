import { Plus } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import {
    CheckListIcon,
    DashedLineCircleIcon,
    Layers01Icon,
    Loading03Icon,
    UserIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { groupTasksByStatus, type TaskAssigneeFilter, type TaskView } from './task-presentation.ts';
import { TaskStatusGroup } from './tasks-list.tsx';

const taskViews: Array<{ icon: IconSvgElement; label: string; value: TaskView }> = [
    { icon: CheckListIcon, label: 'All tasks', value: 'all' },
    { icon: Loading03Icon, label: 'Active', value: 'active' },
    { icon: DashedLineCircleIcon, label: 'Backlog', value: 'backlog' },
    { icon: UserIcon, label: 'My tasks', value: 'mine' },
    { icon: Layers01Icon, label: 'Epics', value: 'epics' },
];

interface TasksViewProps {
    actionErrorMessage: string | null;
    agents: AgentSelectOption[];
    assignee: TaskAssigneeFilter;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    filteredTasks: TaskRecord[];
    onAssigneeChange: (assignee: TaskAssigneeFilter) => void;
    onClearFilters: () => void;
    onCreate: () => void;
    onNavigateToSettings: () => void;
    onOpen: (task: TaskRecord) => void;
    onQueryChange: (query: string) => void;
    onViewChange: (view: TaskView) => void;
    query: string;
    tasks: TaskRecord[];
    view: TaskView;
}

export function TasksView({
    actionErrorMessage,
    agents,
    assignee,
    connectionState,
    filteredTasks,
    onAssigneeChange,
    onClearFilters,
    onCreate,
    onNavigateToSettings,
    onOpen,
    onQueryChange,
    onViewChange,
    query,
    tasks,
    view,
}: TasksViewProps) {
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
                        <SidebarGroupLabel>Views</SidebarGroupLabel>
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

                <section className="flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8">
                        <nav aria-label="Task views" className="flex flex-wrap gap-1 md:hidden">
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

                        <header className="flex items-start">
                            <div>
                                <h1 className="font-semibold text-2xl text-foreground">Tasks</h1>
                                <p className="mt-1 text-muted-foreground text-sm">
                                    Tracked work you and your agents share
                                </p>
                            </div>
                            <Button
                                className="ml-auto shrink-0 rounded-full"
                                onClick={onCreate}
                                size="sm"
                                type="button"
                                variant="secondary"
                            >
                                <Icon aria-hidden="true" className="size-4" icon={Plus} />
                                New task
                            </Button>
                        </header>

                        <div className="flex items-center gap-2">
                            <Select
                                onValueChange={(value) => {
                                    if (value) {
                                        onAssigneeChange(value as TaskAssigneeFilter);
                                    }
                                }}
                                value={assignee}
                            >
                                <SelectTrigger aria-label="Filter by assignee" className="w-44">
                                    <SelectValue>
                                        {assigneeFilterLabel(assignee, agents)}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="anyone">Anyone</SelectItem>
                                    <SelectItem value="me">Me</SelectItem>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                                            <AgentOptionLabel agent={agent} />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <SearchInput
                                aria-label="Search tasks"
                                className="w-full flex-1 [&_[data-slot=input-control]]:rounded-full"
                                name="task-search"
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search tasks..."
                                size="default"
                                value={query}
                            />
                        </div>

                        {groups.length > 0 ? (
                            <div className="grid gap-5">
                                {groups.map((group) => (
                                    <TaskStatusGroup
                                        agents={agents}
                                        key={group.status}
                                        onOpen={onOpen}
                                        status={group.status}
                                        tasks={group.tasks}
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
                </section>
            </div>
        </div>
    );
}

function TasksEmptyResults({ onClearFilters }: { onClearFilters: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
                No tasks match the current view, assignee, or search.
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

function assigneeFilterLabel(assignee: TaskAssigneeFilter, agents: AgentSelectOption[]) {
    if (assignee === 'anyone') {
        return 'Anyone';
    }

    if (assignee === 'me') {
        return 'Me';
    }

    if (assignee === 'unassigned') {
        return 'Unassigned';
    }

    const agentId = assignee.slice('agent:'.length);
    const agent = agents.find((candidate) => candidate.id === agentId);

    return agent ? <AgentOptionLabel agent={agent} /> : agentId;
}
