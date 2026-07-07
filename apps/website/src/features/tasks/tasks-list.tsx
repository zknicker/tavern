import type { IconSvgElement } from '@hugeicons/react';
import {
    CancelCircleIcon,
    CheckmarkCircle02Icon,
    CircleIcon,
    DashedLineCircleIcon,
    Loading03Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import {
    formatTaskNumber,
    type TaskStatus,
    taskPriorityLabels,
    taskStatusLabels,
} from './task-presentation.ts';

const taskStatusIcons: Record<TaskStatus, IconSvgElement> = {
    backlog: DashedLineCircleIcon,
    canceled: CancelCircleIcon,
    done: CheckmarkCircle02Icon,
    in_progress: Loading03Icon,
    todo: CircleIcon,
};

interface TaskStatusGroupProps {
    assigneeName: (task: TaskRecord) => string | null;
    onOpen: (task: TaskRecord) => void;
    status: TaskStatus;
    tasks: TaskRecord[];
}

export function TaskStatusGroup({ assigneeName, onOpen, status, tasks }: TaskStatusGroupProps) {
    return (
        <section className="grid gap-1">
            <div className="flex items-center gap-2 px-3 py-1.5">
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
            <FluidList>
                {tasks.map((task, index) => (
                    <FluidListItem index={index} key={task.id}>
                        <TaskRow assigneeName={assigneeName(task)} onOpen={onOpen} task={task} />
                    </FluidListItem>
                ))}
            </FluidList>
        </section>
    );
}

function TaskRow({
    assigneeName,
    onOpen,
    task,
}: {
    assigneeName: string | null;
    onOpen: (task: TaskRecord) => void;
    task: TaskRecord;
}) {
    const openTask = React.useCallback(() => onOpen(task), [onOpen, task]);

    return (
        <div className="group/task-row relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm">
            <button
                aria-label={`Open ${formatTaskNumber(task)} ${task.title}`}
                className="no-drag absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-window-drag-disabled=""
                onClick={openTask}
                type="button"
            />

            <span className="pointer-events-none relative z-10 w-12 shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
                {formatTaskNumber(task)}
            </span>

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="min-w-0 truncate font-medium text-[15px] text-foreground">
                    {task.title}
                </span>
                {task.kind === 'epic' ? <Badge variant="subtle">Epic</Badge> : null}
                {task.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                        {label}
                    </Badge>
                ))}
            </div>

            <div className="pointer-events-none relative z-10 ml-auto flex shrink-0 items-center gap-2">
                {task.priority !== 'none' ? (
                    <span className="hidden text-muted-foreground text-xs sm:inline">
                        {taskPriorityLabels[task.priority]}
                    </span>
                ) : null}
                {assigneeName ? (
                    <span className="hidden max-w-28 truncate text-muted-foreground text-xs md:inline">
                        {assigneeName}
                    </span>
                ) : null}
                <span className="hidden w-16 text-right text-muted-foreground text-xs sm:inline">
                    {formatRelativeTime(task.updatedAt)}
                </span>
            </div>
        </div>
    );
}
