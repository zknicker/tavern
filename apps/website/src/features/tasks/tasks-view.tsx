import { Plus } from '@hugeicons/core-free-icons';
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
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import type { TaskAssigneeFilter, TaskView } from './task-presentation.ts';
import { TasksList } from './tasks-list.tsx';

const taskViews: Array<{ label: string; value: TaskView }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Backlog', value: 'backlog' },
    { label: 'My tasks', value: 'mine' },
    { label: 'Epics', value: 'epics' },
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

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {actionErrorMessage ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{actionErrorMessage}</p>
                </div>
            ) : null}

            <ScrollArea className="flex-1">
                <div className="mx-auto flex w-full max-w-3xl flex-col px-5 py-8">
                    <header className="relative z-40 flex items-start pb-6">
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

                    <section className="grid gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <TabsSubtle
                                onValueChange={(value) => onViewChange(value as TaskView)}
                                value={view}
                            >
                                <TabsSubtleList>
                                    {taskViews.map((taskView) => (
                                        <TabsSubtleItem
                                            key={taskView.value}
                                            size="sm"
                                            value={taskView.value}
                                        >
                                            {taskView.label}
                                        </TabsSubtleItem>
                                    ))}
                                </TabsSubtleList>
                            </TabsSubtle>
                            <div className="flex items-center gap-2 sm:ml-auto">
                                <Select
                                    onValueChange={(value) => {
                                        if (value) {
                                            onAssigneeChange(value as TaskAssigneeFilter);
                                        }
                                    }}
                                    value={assignee}
                                >
                                    <SelectTrigger aria-label="Filter by assignee">
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
                                    className="w-full sm:max-w-64 [&_[data-slot=input-control]]:rounded-full"
                                    name="task-search"
                                    onChange={(event) => onQueryChange(event.target.value)}
                                    placeholder="Search tasks..."
                                    size="default"
                                    value={query}
                                />
                            </div>
                        </div>

                        {filteredTasks.length > 0 ? (
                            <TasksList
                                assigneeName={assigneeName}
                                onOpen={onOpen}
                                tasks={filteredTasks}
                            />
                        ) : (
                            <TasksBoardPlaceholder
                                isBoardEmpty={tasks.length === 0}
                                onClearFilters={onClearFilters}
                                onCreate={onCreate}
                            />
                        )}
                    </section>
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

function assigneeFilterLabel(
    assignee: TaskAssigneeFilter,
    agents: Array<{ id: string; name: string }>
) {
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
