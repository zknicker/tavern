import { Attachment01Icon, Calendar03Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelChip } from './label-chip.tsx';
import {
    describeTaskWaiting,
    formatTaskNumber,
    type TaskStatus,
    taskBlockedReasonBadgeVariants,
    taskBlockedReasonLabels,
    taskPriorityLabels,
    taskStatusIcons,
    taskStatusLabels,
} from './task-presentation.ts';

interface TaskStatusGroupProps {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    status: TaskStatus;
    tasks: TaskRecord[];
    tasksById: Map<string, TaskRecord>;
}

export function TaskStatusGroup({
    agents,
    onOpen,
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
    task,
    tasksById,
}: {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    task: TaskRecord;
    tasksById: Map<string, TaskRecord>;
}) {
    const openTask = React.useCallback(() => onOpen(task), [onOpen, task]);
    const waiting = describeTaskWaiting(task, tasksById);

    return (
        <div className="group/task-row relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <button
                aria-label={`Open ${formatTaskNumber(task)} ${task.title}`}
                className="no-drag absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                {task.status === 'blocked' && task.blockedReason ? (
                    <Badge variant={taskBlockedReasonBadgeVariants[task.blockedReason.kind]}>
                        {taskBlockedReasonLabels[task.blockedReason.kind]}
                    </Badge>
                ) : null}
                {waiting?.waitsOn ? (
                    <Badge variant="subtle">
                        Waits on T-{waiting.waitsOn.firstNumber}
                        {waiting.waitsOn.more > 0 ? ` +${waiting.waitsOn.more}` : ''}
                    </Badge>
                ) : null}
                {waiting?.scheduledLabel ? (
                    <Badge variant="subtle">
                        <Icon aria-hidden="true" className="size-3" icon={Calendar03Icon} />
                        {waiting.scheduledLabel}
                    </Badge>
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
