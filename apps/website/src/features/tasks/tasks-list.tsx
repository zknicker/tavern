import type { IconSvgElement } from '@hugeicons/react';
import {
    Attachment01Icon,
    Calendar03Icon,
    Layers01Icon,
    Link01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Checkbox } from '../../components/ui/checkbox.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelChip } from './label-chip.tsx';
import { TaskActivityIndicator } from './task-activity-indicator.tsx';
import {
    describeTaskWaiting,
    formatTaskNumber,
    isTaskRunning,
    type TaskStatus,
    taskBlockedReasonBadgeVariants,
    taskBlockedReasonIcons,
    taskBlockedReasonLabels,
    taskPriorityLabels,
    taskStatusIcons,
    taskStatusLabels,
} from './task-presentation.ts';

export type TaskSelectMode = 'range' | 'toggle';

interface TaskStatusGroupProps {
    agents: AgentSelectOption[];
    isSelected: (id: string) => boolean;
    onOpen: (task: TaskRecord) => void;
    onToggleSelect: (task: TaskRecord, mode: TaskSelectMode) => void;
    selectionActive: boolean;
    status: TaskStatus;
    tasks: TaskRecord[];
    tasksById: Map<string, TaskRecord>;
}

export function TaskStatusGroup({
    agents,
    isSelected,
    onOpen,
    onToggleSelect,
    selectionActive,
    status,
    tasks,
    tasksById,
}: TaskStatusGroupProps) {
    return (
        <section>
            <div className="mx-2 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    icon={taskStatusIcons[status]}
                />
                <span className="font-medium text-foreground text-sm">
                    {taskStatusLabels[status]}
                </span>
                <span className="text-muted-foreground/72 text-sm tabular-nums">
                    {tasks.length}
                </span>
            </div>
            <FluidList className="px-2 py-1" highlightClassName="rounded-lg">
                {tasks.map((task, index) => (
                    <FluidListItem index={index} key={task.id}>
                        <TaskRow
                            agents={agents}
                            onOpen={onOpen}
                            onToggleSelect={onToggleSelect}
                            selected={isSelected(task.id)}
                            selectionActive={selectionActive}
                            task={task}
                            tasksById={tasksById}
                        />
                    </FluidListItem>
                ))}
            </FluidList>
        </section>
    );
}

function TaskRowAssignee({
    agents,
    assignee,
}: {
    agents: AgentSelectOption[];
    assignee: TaskRecord['assignee'];
}) {
    if (assignee === null) {
        return null;
    }

    if (assignee.kind === 'user') {
        return (
            <span className="hidden max-w-28 truncate text-muted-foreground text-xs md:inline">
                You
            </span>
        );
    }

    const agent = agents.find((candidate) => candidate.id === assignee.agentId);

    return (
        <span className="hidden max-w-32 text-muted-foreground text-xs md:flex md:min-w-0">
            {agent ? <AgentOptionLabel agent={agent} /> : <span>{assignee.agentId}</span>}
        </span>
    );
}

function TaskRow({
    agents,
    onOpen,
    onToggleSelect,
    selected,
    selectionActive,
    task,
    tasksById,
}: {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    onToggleSelect: (task: TaskRecord, mode: TaskSelectMode) => void;
    selected: boolean;
    selectionActive: boolean;
    task: TaskRecord;
    tasksById: Map<string, TaskRecord>;
}) {
    const handleClick = React.useCallback(
        (event: React.MouseEvent) => {
            if (event.metaKey || event.ctrlKey) {
                onToggleSelect(task, 'toggle');
                return;
            }

            if (event.shiftKey) {
                onToggleSelect(task, 'range');
                return;
            }

            onOpen(task);
        },
        [onOpen, onToggleSelect, task]
    );
    const waiting = describeTaskWaiting(task, tasksById);
    const running = task.status === 'in_progress' && isTaskRunning(task);

    return (
        <div
            className={cn(
                'group/task-row relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
                selected ? 'bg-active' : null
            )}
        >
            <button
                aria-label={`Open ${formatTaskNumber(task)} ${task.title}`}
                className="no-drag absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-window-drag-disabled=""
                onClick={handleClick}
                type="button"
            />

            <span
                className={cn(
                    'relative z-20 flex w-5 shrink-0 items-center justify-center transition-opacity',
                    selected || selectionActive
                        ? 'opacity-100'
                        : 'opacity-0 focus-within:opacity-100 group-hover/task-row:opacity-100'
                )}
            >
                <Checkbox
                    aria-label={`Select ${formatTaskNumber(task)}`}
                    checked={selected}
                    className="size-4"
                    onCheckedChange={() => onToggleSelect(task, 'toggle')}
                />
            </span>

            <span className="pointer-events-none relative z-10 flex w-12 shrink-0 items-center gap-1.5 font-mono text-muted-foreground text-xs tabular-nums">
                {running ? <TaskActivityIndicator label="Working now" /> : null}
                {formatTaskNumber(task)}
            </span>

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="min-w-0 truncate font-medium text-[15px] text-foreground">
                    {task.title}
                </span>
                {task.kind === 'epic' ? (
                    <TaskStateChip icon={Layers01Icon} variant="subtle">
                        Epic
                    </TaskStateChip>
                ) : null}
                {task.status === 'blocked' && task.blockedReason ? (
                    <TaskStateChip
                        icon={taskBlockedReasonIcons[task.blockedReason.kind]}
                        variant={taskBlockedReasonBadgeVariants[task.blockedReason.kind]}
                    >
                        {taskBlockedReasonLabels[task.blockedReason.kind]}
                    </TaskStateChip>
                ) : null}
                {waiting?.waitsOn ? (
                    <TaskStateChip icon={Link01Icon} variant="subtle">
                        Waits on T-{waiting.waitsOn.firstNumber}
                        {waiting.waitsOn.more > 0 ? ` +${waiting.waitsOn.more}` : ''}
                    </TaskStateChip>
                ) : null}
                {waiting?.scheduledLabel ? (
                    <TaskStateChip icon={Calendar03Icon} variant="subtle">
                        {waiting.scheduledLabel}
                    </TaskStateChip>
                ) : null}
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
                {task.attachments.length > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground/70 text-xs tabular-nums">
                        <Icon aria-hidden="true" className="size-3.5" icon={Attachment01Icon} />
                        {task.attachments.length}
                    </span>
                ) : null}
            </div>

            <div className="pointer-events-none relative z-10 ml-auto flex shrink-0 items-center gap-2">
                {task.priority !== 'none' ? (
                    <span className="hidden text-muted-foreground text-xs sm:inline">
                        {taskPriorityLabels[task.priority]}
                    </span>
                ) : null}
                <TaskRowAssignee agents={agents} assignee={task.assignee} />
                <span className="hidden w-16 text-right text-muted-foreground text-xs sm:inline">
                    <RelativeTime value={task.updatedAt} />
                </span>
            </div>
        </div>
    );
}

// State chips (kind, blocked reasons, waiting, dates) speak sentence case and
// lead with an icon, so a row reads as one type system: dotted lowercase chips
// are the label taxonomy, icon-led tinted chips are task state.
function TaskStateChip({
    children,
    icon,
    variant,
}: {
    children: React.ReactNode;
    icon: IconSvgElement;
    variant: React.ComponentProps<typeof Badge>['variant'];
}) {
    return (
        <Badge className="font-sans normal-case tracking-normal" variant={variant}>
            <Icon aria-hidden="true" className="size-3" icon={icon} />
            {children}
        </Badge>
    );
}
