import * as React from 'react';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
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
            <TaskEditorSection title="Status">
                <Select
                    disabled={disabled}
                    onValueChange={(next) => {
                        if (next) {
                            onChange({ status: next as TaskStatus });
                        }
                    }}
                    value={value.status}
                >
                    <SelectTrigger className="w-full">
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
            </TaskEditorSection>

            <TaskEditorSection title="Priority">
                <Select
                    disabled={disabled}
                    onValueChange={(next) => {
                        if (next) {
                            onChange({ priority: next as TaskPriority });
                        }
                    }}
                    value={value.priority}
                >
                    <SelectTrigger className="w-full">
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
            </TaskEditorSection>

            <TaskEditorSection title="Assignee">
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
            </TaskEditorSection>

            {showEpic ? (
                <TaskEditorSection title="Epic">
                    <Select
                        disabled={disabled}
                        onValueChange={(next) => {
                            if (next) {
                                onChange({ epicId: next === noEpicValue ? null : next });
                            }
                        }}
                        value={value.epicId ?? noEpicValue}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue>
                                {value.epicId
                                    ? (epics.find((epic) => epic.id === value.epicId)?.title ??
                                      value.epicId)
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
                </TaskEditorSection>
            ) : null}

            <TaskEditorSection title="Labels">
                <TaskLabelsInput
                    disabled={disabled}
                    labels={value.labels}
                    onCommit={(labels) => onChange({ labels })}
                />
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
            value={labelsValue}
        />
    );
}
