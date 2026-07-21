import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { LabelRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { ContentTopbar } from '../shell/content-topbar.tsx';
import { LabelDot } from './label-chip.tsx';
import { ManageLabelsDialog } from './manage-labels-dialog.tsx';
import { TaskQueueIndicator } from './queue-indicator.tsx';
import type {
    DispatchQueueSummary,
    TaskAssigneeFilter,
    TaskLabelFilter,
} from './task-presentation.ts';

// Sentinel select value that opens the manage dialog instead of filtering.
const manageLabelsValue = 'manage:labels';

interface TasksToolbarProps {
    agents: AgentSelectOption[];
    assignee: TaskAssigneeFilter;
    hideCreate?: boolean;
    label: TaskLabelFilter;
    labels: LabelRecord[];
    onAssigneeChange: (assignee: TaskAssigneeFilter) => void;
    onCreate: () => void;
    onLabelChange: (label: TaskLabelFilter) => void;
    onQueryChange: (query: string) => void;
    query: string;
    queueSummary: DispatchQueueSummary;
    showQueueIndicator: boolean;
}

// The filter row above the board: assignee and label filters, search, the live
// auto-dispatch queue indicator (only while enabled), and New task.
export function TasksToolbar({
    agents,
    assignee,
    hideCreate = false,
    label,
    labels,
    onAssigneeChange,
    onCreate,
    onLabelChange,
    onQueryChange,
    query,
    queueSummary,
    showQueueIndicator,
}: TasksToolbarProps) {
    const [manageLabelsOpen, setManageLabelsOpen] = React.useState(false);

    return (
        <ContentTopbar className="no-drag">
            <Select
                onValueChange={(value) => {
                    if (value) {
                        onAssigneeChange(value as TaskAssigneeFilter);
                    }
                }}
                value={assignee}
            >
                <SelectTrigger aria-label="Filter by assignee" className="w-48">
                    <SelectValue>{assigneeFilterLabel(assignee, agents)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="anyone">Anyone</SelectItem>
                    <SelectItem value="me">Me</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent) => (
                        <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                            <AgentOptionLabel agent={agent} />
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                onValueChange={(value) => {
                    if (value === manageLabelsValue) {
                        setManageLabelsOpen(true);
                        return;
                    }
                    if (value) {
                        onLabelChange(value);
                    }
                }}
                value={label}
            >
                <SelectTrigger aria-label="Filter by label" className="w-40">
                    <SelectValue>{labelFilterValue(label, labels)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any label</SelectItem>
                    {labels.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                            <span className="flex items-center gap-2">
                                <LabelDot color={candidate.color} />
                                {candidate.name}
                            </span>
                        </SelectItem>
                    ))}
                    <SelectItem value={manageLabelsValue}>
                        <span className="text-muted-foreground">Manage labels...</span>
                    </SelectItem>
                </SelectContent>
            </Select>
            <SearchInput
                aria-label="Search tasks"
                className="w-full max-w-96"
                name="task-search"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search tasks..."
                size="default"
                value={query}
            />
            {showQueueIndicator ? (
                <div className="ml-auto">
                    <TaskQueueIndicator
                        queued={queueSummary.queued}
                        running={queueSummary.running}
                    />
                </div>
            ) : null}
            {hideCreate ? null : (
                // Hidden in the embedded conversation tab: the global form
                // cannot carry the conversation origin (originChatId is
                // runtime-set on tasks filed from chat).
                <Button
                    className={cn('shrink-0', showQueueIndicator ? null : 'ml-auto')}
                    onClick={onCreate}
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" className="size-4" icon={Plus} />
                    New task
                </Button>
            )}

            <ManageLabelsDialog onOpenChange={setManageLabelsOpen} open={manageLabelsOpen} />
        </ContentTopbar>
    );
}

function labelFilterValue(label: TaskLabelFilter, labels: LabelRecord[]) {
    if (label === 'all') {
        return 'Any label';
    }

    const match = labels.find((candidate) => candidate.id === label);

    return match ? (
        <span className="flex items-center gap-2">
            <LabelDot color={match.color} />
            {match.name}
        </span>
    ) : (
        'Any label'
    );
}

function assigneeFilterLabel(assignee: TaskAssigneeFilter, agents: AgentSelectOption[]) {
    if (assignee === 'anyone') {
        return 'Anyone';
    }

    if (assignee === 'me') {
        return 'Me';
    }

    if (assignee === 'unassigned') {
        return 'Unassigned';
    }

    const agentId = assignee.slice('agent:'.length);
    const agent = agents.find((candidate) => candidate.id === agentId);

    return agent ? <AgentOptionLabel agent={agent} /> : agentId;
}
