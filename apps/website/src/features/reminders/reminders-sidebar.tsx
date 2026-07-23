import {
    AlertCircleIcon,
    CancelCircleIcon,
    CheckmarkCircle02Icon,
    Clock,
    ListViewIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { isSameReminderSelection, type ReminderSelection } from './reminder-selection.ts';

export interface RemindersAgentEntry extends AgentSelectOption {
    reminderCount: number;
}

export interface RemindersCounts {
    canceled: number;
    failures: number;
    fired: number;
    scheduled: number;
    total: number;
}

interface RemindersSidebarProps {
    agents: RemindersAgentEntry[];
    className?: string;
    counts: RemindersCounts;
    onSelect: (selection: ReminderSelection) => void;
    selection: ReminderSelection;
}

export function RemindersSidebar({
    agents,
    className,
    counts,
    onSelect,
    selection,
}: RemindersSidebarProps) {
    const row = (
        label: string,
        icon: IconSvgElement,
        target: ReminderSelection,
        count?: number
    ) => (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isSameReminderSelection(selection, target)}
                onClick={() => onSelect(target)}
            >
                <Icon aria-hidden="true" icon={icon} />
                <span className="min-w-0 truncate">{label}</span>
                {count === undefined ? null : <RowCount count={count} />}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );

    return (
        <aside
            className={cn(
                'flex min-h-0 flex-col overflow-y-auto border-[var(--content-card-border)] border-r bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)]',
                className
            )}
        >
            <SidebarGroup className="pt-0">
                <SidebarGroupContent>
                    <SidebarMenu>
                        {row('All', ListViewIcon, { filter: 'all', kind: 'filter' }, counts.total)}
                        {row(
                            'Scheduled',
                            Clock,
                            { filter: 'scheduled', kind: 'filter' },
                            counts.scheduled
                        )}
                        {row(
                            'Fired',
                            CheckmarkCircle02Icon,
                            { filter: 'fired', kind: 'filter' },
                            counts.fired
                        )}
                        {row(
                            'Canceled',
                            CancelCircleIcon,
                            { filter: 'canceled', kind: 'filter' },
                            counts.canceled
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
                <SidebarGroupLabel>Runs</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {row('Recent runs', Clock, { failuresOnly: false, kind: 'runs' })}
                        {row(
                            'Failures',
                            AlertCircleIcon,
                            { failuresOnly: true, kind: 'runs' },
                            counts.failures
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
            {agents.length > 0 ? (
                <SidebarGroup>
                    <SidebarGroupLabel>Agents</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {agents.map((agent) => (
                                <SidebarMenuItem key={agent.id}>
                                    <SidebarMenuButton
                                        isActive={isSameReminderSelection(selection, {
                                            agentId: agent.id,
                                            kind: 'agent',
                                        })}
                                        onClick={() =>
                                            onSelect({ agentId: agent.id, kind: 'agent' })
                                        }
                                    >
                                        <AgentOptionLabel agent={agent} />
                                        <RowCount count={agent.reminderCount} />
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ) : null}
        </aside>
    );
}

function RowCount({ count }: { count: number }) {
    return (
        <span className="ml-auto shrink-0 text-sidebar-muted text-xs tabular-nums">{count}</span>
    );
}
