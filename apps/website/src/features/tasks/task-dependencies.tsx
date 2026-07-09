import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { PickerPopover } from '../agents/picker-popover.tsx';
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import { formatTaskNumber, taskStatusIcons, taskStatusLabels } from './task-presentation.ts';

interface TaskDependenciesProps {
    disabled?: boolean;
    onChange: (blockedBy: string[]) => void;
    onOpenTask: (taskId: string) => void;
    // The task being edited, so we exclude it from the picker.
    task: TaskRecord;
    // All tasks, used to resolve dependency ids and offer the picker.
    tasks: TaskRecord[];
}

// The tasks this task waits on. Removable rows plus a searchable picker over
// other tasks. Epics can't have dependencies, so this section is only rendered
// for kind=task by the caller.
export function TaskDependencies({
    disabled = false,
    onChange,
    onOpenTask,
    task,
    tasks,
}: TaskDependenciesProps) {
    const dependencies = React.useMemo(
        () =>
            task.blockedBy
                .map((id) => tasks.find((candidate) => candidate.id === id))
                .filter((dep): dep is TaskRecord => dep != null),
        [task.blockedBy, tasks]
    );

    const linked = new Set(task.blockedBy);
    const options = tasks
        .filter(
            (candidate) =>
                candidate.kind === 'task' && candidate.id !== task.id && !linked.has(candidate.id)
        )
        .map((candidate) => ({
            id: candidate.id,
            name: `${formatTaskNumber(candidate)} ${candidate.title}`,
        }));

    const addDependency = (id: string) => {
        if (linked.has(id)) {
            return;
        }

        onChange([...task.blockedBy, id]);
    };

    const removeDependency = (id: string) => {
        onChange(task.blockedBy.filter((candidate) => candidate !== id));
    };

    return (
        <TaskEditorSection title="Dependencies">
            <div className="grid gap-2">
                {dependencies.length > 0 ? (
                    <ul className="grid gap-1">
                        {dependencies.map((dep) => (
                            <DependencyRow
                                dep={dep}
                                disabled={disabled}
                                key={dep.id}
                                onOpen={() => onOpenTask(dep.id)}
                                onRemove={() => removeDependency(dep.id)}
                            />
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">No dependencies.</p>
                )}
                <div>
                    <PickerPopover
                        emptyText="No other tasks to depend on."
                        isPending={disabled}
                        items={options}
                        label="Add dependency"
                        onAdd={(item) => addDependency(item.id)}
                        searchPlaceholder="Search tasks..."
                        triggerVariant="ghost"
                    />
                </div>
            </div>
        </TaskEditorSection>
    );
}

function DependencyRow({
    dep,
    disabled,
    onOpen,
    onRemove,
}: {
    dep: TaskRecord;
    disabled: boolean;
    onOpen: () => void;
    onRemove: () => void;
}) {
    return (
        <li className="group/dep relative flex items-center gap-2 rounded-md pe-8 text-sm">
            <button
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onOpen}
                type="button"
            >
                <Icon
                    aria-label={taskStatusLabels[dep.status]}
                    className="size-3.5 shrink-0 text-muted-foreground"
                    icon={taskStatusIcons[dep.status]}
                />
                <span className="shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
                    {formatTaskNumber(dep)}
                </span>
                <span className="min-w-0 truncate text-foreground">{dep.title}</span>
            </button>
            <button
                aria-label={`Remove dependency ${formatTaskNumber(dep)}`}
                className="absolute end-1 rounded-md p-1 text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 group-hover/dep:text-muted-foreground"
                disabled={disabled}
                onClick={onRemove}
                type="button"
            >
                <Icon className="size-3.5" icon={Cancel01Icon} />
            </button>
        </li>
    );
}
