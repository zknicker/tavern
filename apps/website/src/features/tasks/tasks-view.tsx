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
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
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
    assigneeName: (task: TaskRecord) => string | null;
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
    assigneeName,
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

            <ScrollArea className="flex-1">
                <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-10 gap-y-6 px-5 py-8 md:grid-cols-[11rem_minmax(0,1fr)]">
                    <nav
                        aria-label="Task views"
                        className="flex flex-row flex-wrap gap-1 self-start md:sticky md:top-8 md:flex-col"
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

                    <div className="flex min-w-0 flex-col gap-5">
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
                                        assigneeName={assigneeName}
                                        key={group.status}
                                        onOpen={onOpen}
                                        status={group.status}
                                        tasks={group.tasks}
                                    />
                                ))}
                            </div>
                        ) : (
                            <TasksBoardPlaceholder
                                isBoardEmpty={tasks.length === 0}
                                onClearFilters={onClearFilters}
                                onCreate={onCreate}
                            />
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

function TasksBoardPlaceholder({
    isBoardEmpty,
    onClearFilters,
    onCreate,
}: {
    isBoardEmpty: boolean;
    onClearFilters: () => void;
    onCreate: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/70 border-dashed px-6 py-14 text-center">
            {isBoardEmpty ? (
                <>
                    <p className="text-muted-foreground text-sm">
                        Create a task, or ask an agent to file one from chat.
                    </p>
                    <Button
                        className="rounded-full"
                        onClick={onCreate}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        <Icon aria-hidden="true" className="size-4" icon={Plus} />
                        New task
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-muted-foreground text-sm">
                        No tasks match the current view, assignee, or search.
                    </p>
                    <Button onClick={onClearFilters} size="sm" type="button" variant="ghost">
                        Clear filters
                    </Button>
                </>
            )}
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

    return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}
