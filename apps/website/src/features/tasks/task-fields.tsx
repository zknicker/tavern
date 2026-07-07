import type { ReactNode } from 'react';
import * as React from 'react';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Label } from '../../components/ui/primitives/label.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import {
    type TaskPriority,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

export interface TaskFieldsValue {
    assignee: TaskRecord['assignee'];
    epicId: string | null;
    labels: string[];
    priority: TaskPriority;
    status: TaskStatus;
}

interface TaskFieldsProps {
    agents: AgentSelectOption[];
    disabled?: boolean;
    epics: Array<{ id: string; title: string }>;
    onChange: (patch: Partial<TaskFieldsValue>) => void;
    showEpic: boolean;
    value: TaskFieldsValue;
}

const unassignedValue = 'unassigned';
const noEpicValue = 'none';

export function TaskFieldRow({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <Label className="shrink-0 text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

export function TaskFields({
    agents,
    disabled = false,
    epics,
    onChange,
    showEpic,
    value,
}: TaskFieldsProps) {
    const assigneeValue =
        value.assignee === null
            ? unassignedValue
            : value.assignee.kind === 'user'
              ? 'user'
              : value.assignee.agentId;
    const assigneeAgent = agents.find((agent) => agent.id === assigneeValue);

    return (
        <>
            <TaskEditorSection title="Details">
                <div className="grid gap-2">
                    <TaskFieldRow label="Status">
                        <Select
                            disabled={disabled}
                            onValueChange={(next) => {
                                if (next) {
                                    onChange({ status: next as TaskStatus });
                                }
                            }}
                            value={value.status}
                        >
                            <SelectTrigger className="max-w-[12rem]" size="sm">
                                <SelectValue>{taskStatusLabels[value.status]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {taskStatusOrder.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {taskStatusLabels[status]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TaskFieldRow>
                    <TaskFieldRow label="Priority">
                        <Select
                            disabled={disabled}
                            onValueChange={(next) => {
                                if (next) {
                                    onChange({ priority: next as TaskPriority });
                                }
                            }}
                            value={value.priority}
                        >
                            <SelectTrigger className="max-w-[12rem]" size="sm">
                                <SelectValue>{taskPriorityLabels[value.priority]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {taskPriorityOrder.map((priority) => (
                                    <SelectItem key={priority} value={priority}>
                                        {taskPriorityLabels[priority]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TaskFieldRow>
                    <TaskFieldRow label="Assignee">
                        <Select
                            disabled={disabled}
                            onValueChange={(next) => {
                                if (!next) {
                                    return;
                                }

                                if (next === unassignedValue) {
                                    onChange({ assignee: null });
                                } else if (next === 'user') {
                                    onChange({ assignee: { kind: 'user' } });
                                } else {
                                    onChange({ assignee: { agentId: next, kind: 'agent' } });
                                }
                            }}
                            value={assigneeValue}
                        >
                            <SelectTrigger className="max-w-[12rem]" size="sm">
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
                    </TaskFieldRow>
                </div>
            </TaskEditorSection>

            <Separator />

            <TaskEditorSection title="Organize">
                <div className="grid gap-2">
                    {showEpic ? (
                        <TaskFieldRow label="Epic">
                            <Select
                                disabled={disabled}
                                onValueChange={(next) => {
                                    if (next) {
                                        onChange({ epicId: next === noEpicValue ? null : next });
                                    }
                                }}
                                value={value.epicId ?? noEpicValue}
                            >
                                <SelectTrigger className="max-w-[12rem]" size="sm">
                                    <SelectValue>
                                        {value.epicId
                                            ? (epics.find((epic) => epic.id === value.epicId)
                                                  ?.title ?? value.epicId)
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
                        </TaskFieldRow>
                    ) : null}
                    <TaskFieldRow label="Labels">
                        <TaskLabelsInput
                            disabled={disabled}
                            labels={value.labels}
                            onCommit={(labels) => onChange({ labels })}
                        />
                    </TaskFieldRow>
                </div>
            </TaskEditorSection>
        </>
    );
}

function TaskLabelsInput({
    disabled,
    labels,
    onCommit,
}: {
    disabled: boolean;
    labels: string[];
    onCommit: (labels: string[]) => void;
}) {
    const [labelsValue, setLabelsValue] = React.useState(labels.join(', '));

    React.useEffect(() => {
        setLabelsValue(labels.join(', '));
    }, [labels]);

    return (
        <Input
            className="max-w-[12rem]"
            disabled={disabled}
            onBlur={() => {
                const next = labelsValue
                    .split(',')
                    .map((label) => label.trim())
                    .filter(Boolean);

                if (next.join(',') !== labels.join(',')) {
                    onCommit(next);
                }
            }}
            onChange={(event) => setLabelsValue(event.currentTarget.value)}
            placeholder="comma, separated"
            size="sm"
            value={labelsValue}
        />
    );
}
