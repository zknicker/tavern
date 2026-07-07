import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import {
    type TaskPriority,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

export interface TaskNewDialogAgentOption {
    id: string;
    name: string;
}

export interface TaskNewDialogSubmit {
    assigneeAgentId: string | null;
    description: string | null;
    epicId: string | null;
    kind: 'epic' | 'task';
    priority: TaskPriority;
    status: TaskStatus;
    title: string;
}

interface TaskNewDialogProps {
    agents: TaskNewDialogAgentOption[];
    epics: TaskRecord[];
    errorMessage: string | null;
    isOpen: boolean;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (input: TaskNewDialogSubmit) => Promise<void>;
}

const unassignedValue = 'unassigned';
const noEpicValue = 'none';

export function TaskNewDialog({
    agents,
    epics,
    errorMessage,
    isOpen,
    isPending,
    onClose,
    onSubmit,
}: TaskNewDialogProps) {
    const [kind, setKind] = React.useState<'epic' | 'task'>('task');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [status, setStatus] = React.useState<TaskStatus>('backlog');
    const [priority, setPriority] = React.useState<TaskPriority>('none');
    const [assignee, setAssignee] = React.useState(unassignedValue);
    const [epicId, setEpicId] = React.useState(noEpicValue);

    React.useEffect(() => {
        if (isOpen) {
            setKind('task');
            setTitle('');
            setDescription('');
            setStatus('backlog');
            setPriority('none');
            setAssignee(unassignedValue);
            setEpicId(noEpicValue);
        }
    }, [isOpen]);

    const submit = () => {
        const trimmedTitle = title.trim();

        if (!trimmedTitle) {
            return;
        }

        void onSubmit({
            assigneeAgentId: assignee === unassignedValue ? null : assignee,
            description: description.trim() ? description.trim() : null,
            epicId: kind === 'task' && epicId !== noEpicValue ? epicId : null,
            kind,
            priority,
            status,
            title: trimmedTitle,
        });
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!(nextOpen || isPending)) {
                    onClose();
                }
            }}
            open={isOpen}
        >
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>{kind === 'epic' ? 'New epic' : 'New task'}</DialogTitle>
                    <DialogDescription>
                        A tracked work item. Agents can pick it up and update it from chat.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <TabsSubtle
                        onValueChange={(value) => setKind(value as 'epic' | 'task')}
                        value={kind}
                    >
                        <TabsSubtleList className="w-full">
                            <TabsSubtleItem className="flex-1" size="sm" value="task">
                                Task
                            </TabsSubtleItem>
                            <TabsSubtleItem className="flex-1" size="sm" value="epic">
                                Epic
                            </TabsSubtleItem>
                        </TabsSubtleList>
                    </TabsSubtle>

                    <label className="block space-y-1.5">
                        <span className="font-medium text-sm">Title</span>
                        <Input
                            autoFocus
                            disabled={isPending}
                            onChange={(event) => setTitle(event.currentTarget.value)}
                            placeholder="e.g. Fix the invite email link"
                            value={title}
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="font-medium text-sm">Description</span>
                        <Textarea
                            disabled={isPending}
                            onChange={(event) => setDescription(event.currentTarget.value)}
                            placeholder="Context, acceptance criteria, links (Markdown supported)."
                            rows={3}
                            value={description}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                            <span className="font-medium text-sm">Status</span>
                            <Select
                                disabled={isPending}
                                onValueChange={(value) => {
                                    if (value) {
                                        setStatus(value as TaskStatus);
                                    }
                                }}
                                value={status}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>{taskStatusLabels[status]}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {taskStatusOrder.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {taskStatusLabels[value]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                        <label className="block space-y-1.5">
                            <span className="font-medium text-sm">Priority</span>
                            <Select
                                disabled={isPending}
                                onValueChange={(value) => {
                                    if (value) {
                                        setPriority(value as TaskPriority);
                                    }
                                }}
                                value={priority}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>{taskPriorityLabels[priority]}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {taskPriorityOrder.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {taskPriorityLabels[value]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                        <label className="block space-y-1.5">
                            <span className="font-medium text-sm">Assignee</span>
                            <Select
                                disabled={isPending}
                                onValueChange={(value) => {
                                    if (value) {
                                        setAssignee(value);
                                    }
                                }}
                                value={assignee}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>
                                        {assignee === unassignedValue
                                            ? 'Unassigned'
                                            : (agents.find((agent) => agent.id === assignee)
                                                  ?.name ?? assignee)}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={unassignedValue}>Unassigned</SelectItem>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                        {kind === 'task' ? (
                            <label className="block space-y-1.5">
                                <span className="font-medium text-sm">Epic</span>
                                <Select
                                    disabled={isPending}
                                    onValueChange={(value) => {
                                        if (value) {
                                            setEpicId(value);
                                        }
                                    }}
                                    value={epicId}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue>
                                            {epicId === noEpicValue
                                                ? 'No epic'
                                                : (epics.find((epic) => epic.id === epicId)
                                                      ?.title ?? epicId)}
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
                            </label>
                        ) : null}
                    </div>

                    {errorMessage ? (
                        <p className="text-destructive-foreground text-sm">{errorMessage}</p>
                    ) : null}

                    <DialogFooter variant="bare">
                        <Button disabled={isPending} onClick={onClose} variant="secondary">
                            Cancel
                        </Button>
                        <Button disabled={!title.trim()} loading={isPending} type="submit">
                            {kind === 'epic' ? 'Create epic' : 'Create task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
