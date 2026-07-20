import { AlertCircleIcon, Clock, ListViewIcon, PlayIcon } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { PauseIcon } from '@hugeicons-pro/core-stroke-rounded';
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
import { type AutomationsSelection, isSameAutomationsSelection } from './automations-selection.ts';

export interface AutomationsAgentEntry extends AgentSelectOption {
    jobCount: number;
}

export interface AutomationsCounts {
    active: number;
    failures: number;
    paused: number;
    total: number;
}

interface AutomationsSidebarProps {
    agents: AutomationsAgentEntry[];
    className?: string;
    counts: AutomationsCounts;
    onSelect: (selection: AutomationsSelection) => void;
    selection: AutomationsSelection;
}

export function AutomationsSidebar({
    agents,
    className,
    counts,
    onSelect,
    selection,
}: AutomationsSidebarProps) {
    const row = (
        label: string,
        icon: IconSvgElement,
        target: AutomationsSelection,
        count?: number
    ) => (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isSameAutomationsSelection(selection, target)}
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
                            'Active',
                            PlayIcon,
                            { filter: 'active', kind: 'filter' },
                            counts.active
                        )}
                        {row(
                            'Paused',
                            PauseIcon,
                            { filter: 'paused', kind: 'filter' },
                            counts.paused
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
                                        isActive={isSameAutomationsSelection(selection, {
                                            agentId: agent.id,
                                            kind: 'agent',
                                        })}
                                        onClick={() =>
                                            onSelect({ agentId: agent.id, kind: 'agent' })
                                        }
                                    >
                                        <AgentOptionLabel agent={agent} />
                                        <RowCount count={agent.jobCount} />
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
