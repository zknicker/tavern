import { SentIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import {
    type TaskPriority,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

const unassignedValue = 'unassigned';
const noEpicValue = 'none';

interface TaskPropertiesPanelProps {
    agents: AgentSelectOption[];
    dispatchAgentId: string | null;
    dispatchDisabledReason: string | null;
    epics: TaskRecord[];
    isDispatching: boolean;
    isSaving: boolean;
    onAssigneeChange: (assignee: TaskRecord['assignee']) => void;
    onDispatch: () => void;
    onDispatchAgentChange: (agentId: string) => void;
    onEpicChange: (epicId: string | null) => void;
    onLabelsChange: (labels: string[]) => void;
    onPriorityChange: (priority: TaskPriority) => void;
    onStatusChange: (status: TaskStatus) => void;
    task: TaskRecord;
}

export function TaskPropertiesPanel({
    agents,
    dispatchAgentId,
    dispatchDisabledReason,
    epics,
    isDispatching,
    isSaving,
    onAssigneeChange,
    onDispatch,
    onDispatchAgentChange,
    onEpicChange,
    onLabelsChange,
    onPriorityChange,
    onStatusChange,
    task,
}: TaskPropertiesPanelProps) {
    const [labelsValue, setLabelsValue] = React.useState(task.labels.join(', '));

    React.useEffect(() => {
        setLabelsValue(task.labels.join(', '));
    }, [task.labels]);

    const assigneeValue =
        task.assignee === null
            ? unassignedValue
            : task.assignee.kind === 'user'
              ? 'user'
              : task.assignee.agentId;
    const assigneeAgent = agents.find((agent) => agent.id === assigneeValue);
    const dispatchAgent = agents.find((agent) => agent.id === dispatchAgentId);

    return (
        <div className="flex w-full flex-col gap-4 lg:w-64">
            <PropertyField label="Status">
                <Select
                    disabled={isSaving}
                    onValueChange={(value) => {
                        if (value) {
                            onStatusChange(value as TaskStatus);
                        }
                    }}
                    value={task.status}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue>{taskStatusLabels[task.status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {taskStatusOrder.map((status) => (
                            <SelectItem key={status} value={status}>
                                {taskStatusLabels[status]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </PropertyField>

            <PropertyField label="Priority">
                <Select
                    disabled={isSaving}
                    onValueChange={(value) => {
                        if (value) {
                            onPriorityChange(value as TaskPriority);
                        }
                    }}
                    value={task.priority}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue>{taskPriorityLabels[task.priority]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {taskPriorityOrder.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                                {taskPriorityLabels[priority]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </PropertyField>

            <PropertyField label="Assignee">
                <Select
                    disabled={isSaving}
                    onValueChange={(value) => {
                        if (!value) {
                            return;
                        }

                        if (value === unassignedValue) {
                            onAssigneeChange(null);
                        } else if (value === 'user') {
                            onAssigneeChange({ kind: 'user' });
                        } else {
                            onAssigneeChange({ agentId: value, kind: 'agent' });
                        }
                    }}
                    value={assigneeValue}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue>
                            {assigneeValue === unassignedValue ? (
                                'Unassigned'
                            ) : assigneeValue === 'user' ? (
                                'You'
                            ) : assigneeAgent ? (
                                <AgentOptionLabel agent={assigneeAgent} />
                            ) : (
                                assigneeValue
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={unassignedValue}>Unassigned</SelectItem>
                        <SelectItem value="user">You</SelectItem>
                        {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                                <AgentOptionLabel agent={agent} />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </PropertyField>

            <PropertyField label="Dispatch">
                <div className="grid gap-2">
                    <Select
                        disabled={isDispatching || agents.length === 0}
                        onValueChange={(value) => {
                            if (value) {
                                onDispatchAgentChange(value);
                            }
                        }}
                        value={dispatchAgentId ?? ''}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose agent">
                                {dispatchAgent ? (
                                    <AgentOptionLabel agent={dispatchAgent} />
                                ) : (
                                    'Choose agent'
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    <AgentOptionLabel agent={agent} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        disabled={dispatchDisabledReason !== null || dispatchAgentId === null}
                        loading={isDispatching}
                        onClick={onDispatch}
                        title={dispatchDisabledReason ?? undefined}
                        type="button"
                        variant="secondary"
                    >
                        <Icon aria-hidden="true" className="size-4" icon={SentIcon} />
                        Dispatch to agent
                    </Button>
                    <p className="text-muted-foreground text-xs">
                        Sends this task into the agent's direct chat so the work happens in the
                        room.
                    </p>
                </div>
            </PropertyField>

            {task.kind === 'task' ? (
                <PropertyField label="Epic">
                    <Select
                        disabled={isSaving}
                        onValueChange={(value) => {
                            if (value) {
                                onEpicChange(value === noEpicValue ? null : value);
                            }
                        }}
                        value={task.epicId ?? noEpicValue}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue>
                                {task.epicId
                                    ? (epics.find((epic) => epic.id === task.epicId)?.title ??
                                      task.epicId)
                                    : 'No epic'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={noEpicValue}>No epic</SelectItem>
                            {epics.map((epic) => (
                                <SelectItem key={epic.id} value={epic.id}>
                                    {epic.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyField>
            ) : null}

            <PropertyField label="Labels">
                <Input
                    disabled={isSaving}
                    onBlur={() => {
                        const labels = labelsValue
                            .split(',')
                            .map((label) => label.trim())
                            .filter(Boolean);

                        if (labels.join(',') !== task.labels.join(',')) {
                            onLabelsChange(labels);
                        }
                    }}
                    onChange={(event) => setLabelsValue(event.currentTarget.value)}
                    placeholder="comma, separated"
                    value={labelsValue}
                />
            </PropertyField>

            <div className="space-y-1 text-muted-foreground text-xs">
                <p>Created {formatRelativeTime(task.createdAt)}</p>
                <p>Updated {formatRelativeTime(task.updatedAt)}</p>
            </div>
        </div>
    );
}

function PropertyField({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="grid gap-1.5">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {label}
            </span>
            {children}
        </div>
    );
}
