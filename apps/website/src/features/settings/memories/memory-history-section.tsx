import { ArrowRight01Icon, ChatIcon, Moon02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { MemoryJobSummary } from '@tavern/api';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsGroup, SettingsSection } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useChatList } from '../../../hooks/chats/use-chat-list.ts';
import { useMemoryJobList, useRunMemoryDream } from '../../../hooks/memory/use-memory-history.ts';
import { formatRelativeTime } from '../../../lib/format.ts';
import { cn } from '../../../lib/utils.ts';
import {
    memoryJobBadge,
    memoryJobDetailLine,
    memoryJobKindLabel,
    memoryJobTitle,
} from './memory-job-copy.ts';
import { MemoryJobExpandedDetail } from './memory-job-detail.tsx';

export function MemoryHistorySection() {
    const [expandedJobId, setExpandedJobId] = React.useState<string | null>(null);
    const jobsQuery = useMemoryJobList();
    const chatsQuery = useChatList();
    const agentsQuery = useAgentList();
    const runDream = useRunMemoryDream(setExpandedJobId);

    const jobs = jobsQuery.data?.jobs ?? [];
    const agents = agentsQuery.data?.agents ?? [];
    const chatName = (chatId: string | null) =>
        chatId ? (chatsQuery.data?.itemsById[chatId]?.displayName ?? null) : null;
    const agentName = (agentId: string) =>
        agents.find((agent) => agent.id === agentId)?.name ?? null;

    return (
        <SettingsSection
            action={
                <DreamNowAction
                    agents={agents}
                    isPending={runDream.isPending}
                    onDream={(agentId) => runDream.mutate({ agentId })}
                />
            }
            title="History"
        >
            <SettingsGroup>
                {renderHistoryBody({
                    agentName,
                    chatName,
                    error: jobsQuery.error?.message ?? runDream.error?.message ?? null,
                    expandedJobId,
                    isLoading: jobsQuery.isPending,
                    jobs,
                    onToggle: (id) => setExpandedJobId((current) => (current === id ? null : id)),
                })}
            </SettingsGroup>
        </SettingsSection>
    );
}

function DreamNowAction({
    agents,
    isPending,
    onDream,
}: {
    agents: Array<{ id: string; name: string }>;
    isPending: boolean;
    onDream: (agentId: string) => void;
}) {
    if (agents.length <= 1) {
        const agentId = agents[0]?.id ?? null;
        return (
            <Button
                disabled={!agentId}
                loading={isPending}
                onClick={() => agentId && onDream(agentId)}
                size="sm"
                variant="secondary"
            >
                <Icon icon={Moon02Icon} />
                Dream now
            </Button>
        );
    }

    return (
        <Menu>
            <MenuTrigger render={<Button loading={isPending} size="sm" variant="secondary" />}>
                <Icon icon={Moon02Icon} />
                Dream now
            </MenuTrigger>
            <MenuPopup align="end">
                {agents.map((agent) => (
                    <MenuItem key={agent.id} onClick={() => onDream(agent.id)}>
                        {agent.name}
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function renderHistoryBody({
    agentName,
    chatName,
    error,
    expandedJobId,
    isLoading,
    jobs,
    onToggle,
}: {
    agentName: (agentId: string) => string | null;
    chatName: (chatId: string | null) => string | null;
    error: string | null;
    expandedJobId: string | null;
    isLoading: boolean;
    jobs: MemoryJobSummary[];
    onToggle: (id: string) => void;
}) {
    if (isLoading) {
        return <Skeleton className="m-3 h-16 rounded-md" />;
    }
    if (error) {
        return <p className="px-5 py-4 text-destructive text-sm">{error}</p>;
    }
    if (jobs.length === 0) {
        return (
            <p className="px-5 py-4 text-muted-foreground text-sm">
                No activity yet. Chats are reviewed a few minutes after they go quiet.
            </p>
        );
    }

    return (
        <div className="max-h-[32rem] overflow-y-auto">
            {jobs.map((job, index) => (
                <React.Fragment key={job.id}>
                    {index > 0 ? <Separator /> : null}
                    <MemoryJobRow
                        agentName={agentName(job.agentId)}
                        chatName={chatName(job.chatId)}
                        isExpanded={expandedJobId === job.id}
                        job={job}
                        onToggle={onToggle}
                    />
                    {expandedJobId === job.id ? <MemoryJobExpandedDetail jobId={job.id} /> : null}
                </React.Fragment>
            ))}
        </div>
    );
}

function MemoryJobRow({
    agentName,
    chatName,
    isExpanded,
    job,
    onToggle,
}: {
    agentName: string | null;
    chatName: string | null;
    isExpanded: boolean;
    job: MemoryJobSummary;
    onToggle: (id: string) => void;
}) {
    const badge = memoryJobBadge(job);
    const detailLine = memoryJobDetailLine(job);
    const meta = [
        memoryJobKindLabel(job),
        agentName,
        formatRelativeTime(job.completedAt ?? job.createdAt),
        detailLine,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <button
            className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-accent/45',
                isExpanded ? 'bg-accent/35' : 'hover:bg-accent/45',
                job.status === 'skipped' && !isExpanded && 'opacity-72'
            )}
            onClick={() => onToggle(job.id)}
            type="button"
        >
            <Icon
                className="size-4.5 shrink-0 text-muted-foreground"
                icon={job.kind === 'dream' ? Moon02Icon : ChatIcon}
            />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-sm">
                    {memoryJobTitle(job, chatName)}
                </span>
                <span className="block truncate text-meta text-muted-foreground">{meta}</span>
            </span>
            {badge ? (
                <Badge size="sm" variant={badge.variant}>
                    {badge.label}
                </Badge>
            ) : null}
            <Icon
                className={cn(
                    'size-4 shrink-0 text-muted-foreground/70',
                    isExpanded && 'rotate-90'
                )}
                icon={ArrowRight01Icon}
            />
        </button>
    );
}
