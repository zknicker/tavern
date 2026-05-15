import type { IconSvgElement } from '@hugeicons/react';
import {
    Chat01Icon,
    HourglassIcon,
    Robot02Icon,
    TerminalIcon,
    ZapIcon,
} from '@hugeicons-pro/core-duotone-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { formatRelativeTime, titleCase, truncate } from '../../lib/format.ts';
import type { AgentListOutput, ChatListOutput, WorkerListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { CronListItem } from '../cron/cron-list-data.ts';

interface OverviewActivityFeedProps {
    agents: AgentListOutput['agents'];
    chats: ChatListOutput['chats'];
    recentCronJobs: CronListItem[];
    workers: WorkerListOutput['workers'];
}

interface OverviewActivityItem {
    headline: string;
    icon: IconSvgElement;
    iconClass: string;
    id: string;
    occurredAt: string;
    sessionKey: string | null;
    tone: 'default' | 'error';
}

const overviewActivityLimit = 8;

export function OverviewActivityFeed({
    agents,
    chats,
    recentCronJobs,
    workers,
}: OverviewActivityFeedProps) {
    const { openSession } = useSessionDrawer();
    const items = buildOverviewActivityItems({
        agents,
        chats,
        recentCronJobs,
        workers,
    });

    if (items.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Recent activity
                </h2>
            </div>

            <div className="divide-y divide-border/60">
                {items.map((item) => {
                    const clickable = item.sessionKey !== null;

                    return (
                        <button
                            className={cn(
                                'flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0',
                                clickable &&
                                    '-mx-2 cursor-pointer rounded-md px-2 transition-colors hover:bg-accent/40'
                            )}
                            disabled={!clickable}
                            key={item.id}
                            onClick={
                                clickable ? () => openSession(item.sessionKey as string) : undefined
                            }
                            type="button"
                        >
                            <Icon
                                className={item.tone === 'error' ? 'text-error/70' : item.iconClass}
                                icon={item.icon}
                                size={15}
                            />
                            <p className="min-w-0 flex-1 truncate text-foreground/70 text-sm">
                                {item.headline}
                            </p>
                            <span className="shrink-0 text-muted-foreground/50 text-xs">
                                {formatRelativeTime(item.occurredAt)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function buildOverviewActivityItems({
    agents,
    chats,
    recentCronJobs,
    workers,
}: OverviewActivityFeedProps): OverviewActivityItem[] {
    const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
    const seenChatSessionKeys = new Set<string>();
    const items = [
        ...workers
            .filter((worker) => worker.kind !== 'cron')
            .map<OverviewActivityItem>((worker) => ({
                headline: getWorkerHeadline(worker),
                ...getWorkerIconConfig(worker.kind),
                id: `worker:${worker.id}`,
                occurredAt: worker.createdAt,
                sessionKey: worker.sessionKey ?? null,
                tone: worker.status === 'failed' ? 'error' : 'default',
            })),
        ...chats.flatMap((chat) =>
            chat.latestSession?.lastActivityAt &&
            !seenChatSessionKeys.has(chat.latestSession.sessionKey)
                ? (() => {
                      seenChatSessionKeys.add(chat.latestSession.sessionKey);

                      return [
                          {
                              headline: getChatHeadline({
                                  agentName:
                                      agentNameById.get(chat.latestSession.agentId ?? '') ??
                                      (chat.latestSession.agentId
                                          ? truncate(chat.latestSession.agentId, 24)
                                          : 'Unknown agent'),
                                  framework: chat.framework,
                                  title: chat.displayName || chat.title,
                              }),
                              icon: Chat01Icon,
                              iconClass: 'text-info/50',
                              id: `chat:${chat.latestSession.sessionKey}`,
                              occurredAt: chat.latestSession.lastActivityAt,
                              sessionKey: chat.latestSession.sessionKey,
                              tone: 'default',
                          } satisfies OverviewActivityItem,
                      ];
                  })()
                : []
        ),
        ...recentCronJobs.flatMap((cronJob) =>
            cronJob.executions.map<OverviewActivityItem>((execution) => ({
                headline: getCronExecutionHeadline(cronJob.name, execution.status),
                icon: HourglassIcon,
                iconClass: 'text-warning/50',
                id: `cron:${cronJob.id}:${execution.id}`,
                occurredAt: execution.occurredAt,
                sessionKey: execution.sessionKey,
                tone: execution.status === 'error' ? 'error' : 'default',
            }))
        ),
    ];

    return items
        .filter((item) => toTimestamp(item.occurredAt) > 0)
        .sort((left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt))
        .slice(0, overviewActivityLimit);
}

function getWorkerIconConfig(kind: WorkerListOutput['workers'][number]['kind']): {
    icon: IconSvgElement;
    iconClass: string;
} {
    switch (kind) {
        case 'cli':
            return { icon: TerminalIcon, iconClass: 'text-info/50' };
        case 'subagent':
            return { icon: Robot02Icon, iconClass: 'text-success/50' };
        case 'acp':
            return { icon: ZapIcon, iconClass: 'text-brand/50' };
        default:
            return { icon: TerminalIcon, iconClass: 'text-muted-foreground/50' };
    }
}

function getWorkerHeadline(worker: WorkerListOutput['workers'][number]) {
    const title = truncate(worker.title, 56);

    switch (worker.kind) {
        case 'subagent':
            return `${worker.agentName} delegated ${title}`;
        case 'cli':
            return `${worker.agentName} launched ${title}`;
        default:
            return `${worker.agentName} started ${title}`;
    }
}

function getChatHeadline({
    agentName,
    framework,
    title,
}: {
    agentName: string;
    framework: string;
    title: string;
}) {
    const destination = title.trim().length > 0 ? title : 'chat';
    const platform = framework === 'tavern' ? '' : framework ? ` on ${titleCase(framework)}` : '';
    return `${agentName} chatted in ${destination}${platform}`;
}

function getCronExecutionHeadline(
    name: string,
    status: CronListItem['executions'][number]['status']
) {
    switch (status) {
        case 'error':
            return `${name} failed`;
        case 'success':
            return `${name} executed`;
        case 'running':
            return `${name} started`;
        case 'queued':
            return `${name} queued`;
        case 'skipped':
            return `${name} skipped`;
        default:
            return `${name} updated`;
    }
}

function toTimestamp(value: string) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
