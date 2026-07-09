import {
    Cancel01Icon,
    CancelCircleIcon,
    Flag03Icon,
    Layers01Icon,
    Tag01Icon,
    UserIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import type { BulkTaskUpdate, BulkTaskUpdateResult } from '../../hooks/tasks/use-task-mutations.ts';
import type { LabelRecord, TaskRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelDot } from './label-chip.tsx';
import {
    type TaskPriority,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusIcons,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

interface TaskBulkActionsProps {
    agents: AgentSelectOption[];
    bulkUpdate: (updates: BulkTaskUpdate[]) => Promise<BulkTaskUpdateResult>;
    epics: Array<{ id: string; title: string }>;
    labels: LabelRecord[];
    onClear: () => void;
    selectedTasks: TaskRecord[];
}

// Floating action bar for a board multi-selection. Each action fans a single
// patch (or a per-task label union) across every selected task and reports
// partial failures via toast. Selection persists after an edit so several
// changes can chain; Clear or Escape dismisses it.
export function TaskBulkActions({
    agents,
    bulkUpdate,
    epics,
    labels,
    onClear,
    selectedTasks,
}: TaskBulkActionsProps) {
    const reduceMotion = useReducedMotion();
    const count = selectedTasks.length;

    const run = async (updates: BulkTaskUpdate[], verb: string) => {
        const result = await bulkUpdate(updates);

        if (result.failed > 0) {
            toastManager.add({
                description: `${result.total - result.failed} of ${result.total} updated. Try again.`,
                title: `Couldn't ${verb} every task`,
                type: 'error',
            });
        }
    };

    const applyPatch = (patch: BulkTaskUpdate['patch'], verb: string) => {
        void run(
            selectedTasks.map((task) => ({ patch, taskId: task.id })),
            verb
        );
    };

    const addLabel = (name: string) => {
        void run(
            selectedTasks.map((task) => ({
                patch: {
                    labels: Array.from(new Set([...task.labels.map((label) => label.name), name])),
                },
                taskId: task.id,
            })),
            'label'
        );
    };

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <AnimatePresence>
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto"
                    exit={{ opacity: 0, y: 8 }}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    transition={{ bounce: 0, duration: 0.18, type: 'spring' }}
                >
                    <Elevated
                        className="flex items-center gap-1 rounded-full border px-2 py-1.5"
                        offset={2}
                        shadowLevel={3}
                    >
                        <span className="px-2 font-medium text-sm tabular-nums">
                            {count} selected
                        </span>
                        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />

                        <BulkStatusMenu onSelect={(status) => applyPatch({ status }, 'update')} />
                        <BulkAssigneeMenu
                            agents={agents}
                            onSelect={(assignee) => applyPatch({ assignee }, 'assign')}
                        />
                        <BulkPriorityMenu
                            onSelect={(priority) => applyPatch({ priority }, 'update')}
                        />
                        {epics.length > 0 ? (
                            <BulkEpicMenu
                                epics={epics}
                                onSelect={(epicId) => applyPatch({ epicId }, 'update')}
                            />
                        ) : null}
                        <BulkLabelMenu labels={labels} onSelect={addLabel} />

                        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
                        <Button
                            className="rounded-full text-destructive-foreground"
                            onClick={() => applyPatch({ status: 'canceled' }, 'cancel')}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={CancelCircleIcon} />
                            Cancel
                        </Button>
                        <Button
                            aria-label="Clear selection"
                            className="rounded-full"
                            onClick={onClear}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={Cancel01Icon} />
                        </Button>
                    </Elevated>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function BulkMenuButton({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <MenuTrigger
            render={
                <Button className="rounded-full" size="sm" type="button" variant="ghost">
                    {children}
                    {label}
                </Button>
            }
        />
    );
}

function BulkStatusMenu({ onSelect }: { onSelect: (status: TaskStatus) => void }) {
    return (
        <Menu>
            <BulkMenuButton label="Status">
                <Icon aria-hidden="true" className="size-4" icon={taskStatusIcons.in_progress} />
            </BulkMenuButton>
            <MenuPopup align="center" side="top">
                {taskStatusOrder.map((status) => (
                    <MenuItem key={status} onClick={() => onSelect(status)}>
                        <Icon aria-hidden="true" icon={taskStatusIcons[status]} />
                        {taskStatusLabels[status]}
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkAssigneeMenu({
    agents,
    onSelect,
}: {
    agents: AgentSelectOption[];
    onSelect: (assignee: TaskRecord['assignee']) => void;
}) {
    return (
        <Menu>
            <BulkMenuButton label="Assignee">
                <Icon aria-hidden="true" className="size-4" icon={UserIcon} />
            </BulkMenuButton>
            <MenuPopup align="center" className="min-w-44" side="top">
                <MenuItem onClick={() => onSelect(null)}>Unassigned</MenuItem>
                <MenuItem onClick={() => onSelect({ kind: 'user' })}>You</MenuItem>
                {agents.length > 0 ? <MenuSeparator /> : null}
                {agents.map((agent) => (
                    <MenuItem
                        key={agent.id}
                        onClick={() => onSelect({ agentId: agent.id, kind: 'agent' })}
                    >
                        <AgentOptionLabel agent={agent} />
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkPriorityMenu({ onSelect }: { onSelect: (priority: TaskPriority) => void }) {
    return (
        <Menu>
            <BulkMenuButton label="Priority">
                <Icon aria-hidden="true" className="size-4" icon={Flag03Icon} />
            </BulkMenuButton>
            <MenuPopup align="center" side="top">
                {taskPriorityOrder.map((priority) => (
                    <MenuItem key={priority} onClick={() => onSelect(priority)}>
                        {taskPriorityLabels[priority]}
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkEpicMenu({
    epics,
    onSelect,
}: {
    epics: Array<{ id: string; title: string }>;
    onSelect: (epicId: string | null) => void;
}) {
    return (
        <Menu>
            <BulkMenuButton label="Epic">
                <Icon aria-hidden="true" className="size-4" icon={Layers01Icon} />
            </BulkMenuButton>
            <MenuPopup align="center" className="min-w-44" side="top">
                <MenuItem onClick={() => onSelect(null)}>No epic</MenuItem>
                <MenuSeparator />
                {epics.map((epic) => (
                    <MenuItem key={epic.id} onClick={() => onSelect(epic.id)}>
                        <span className="truncate">{epic.title}</span>
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkLabelMenu({
    labels,
    onSelect,
}: {
    labels: LabelRecord[];
    onSelect: (name: string) => void;
}) {
    return (
        <Menu>
            <BulkMenuButton label="Label">
                <Icon aria-hidden="true" className="size-4" icon={Tag01Icon} />
            </BulkMenuButton>
            <MenuPopup align="center" className="min-w-44" side="top">
                {labels.length > 0 ? (
                    labels.map((label) => (
                        <MenuItem key={label.id} onClick={() => onSelect(label.name)}>
                            <LabelDot color={label.color} />
                            <span className="truncate">{label.name}</span>
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem disabled>No labels yet</MenuItem>
                )}
            </MenuPopup>
        </Menu>
    );
}
