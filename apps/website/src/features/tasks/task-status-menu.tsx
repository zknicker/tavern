import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { useTaskUpdate } from '../../hooks/tasks/use-task-mutations.ts';
import { cn } from '../../lib/utils.ts';
import {
    type TaskStatus,
    taskStatusClasses,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

export function TaskStatusPill({ status }: { status: TaskStatus }) {
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-caption uppercase tracking-wide',
                taskStatusClasses[status]
            )}
        >
            {taskStatusLabels[status]}
        </span>
    );
}

export function TaskStatusMenu({
    ariaLabel,
    children,
    messageId,
    showPencil = false,
    status,
}: {
    ariaLabel: string;
    children?: React.ReactNode;
    messageId: string;
    showPencil?: boolean;
    status: TaskStatus;
}) {
    const update = useTaskUpdate();
    return (
        <Menu>
            <MenuTrigger
                aria-label={ariaLabel}
                className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {children ?? <TaskStatusPill status={status} />}
                {showPencil ? (
                    <span aria-hidden="true" className="text-caption text-muted-foreground">
                        ✎
                    </span>
                ) : null}
            </MenuTrigger>
            <MenuPopup align="end" className="min-w-40">
                {taskStatusOrder.map((option) => (
                    <MenuItem
                        key={option}
                        onClick={() => update.mutate({ messageId, patch: { status: option } })}
                    >
                        <span className="w-4">
                            {option === status ? (
                                <Icon className="size-4" icon={Tick02Icon} />
                            ) : null}
                        </span>
                        <TaskStatusPill status={option} />
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}
