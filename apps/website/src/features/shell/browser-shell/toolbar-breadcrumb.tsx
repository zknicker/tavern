import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { appRoutes } from '../../../lib/app-routes.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { AgentPresenceBadge } from '../../chats/agent-presence.tsx';
import { getChatAgentId } from '../../chats/chat-list-data.ts';
import { formatTaskNumber } from '../../tasks/task-presentation.ts';
import { TavernTabFavicon } from './tavern-tab-favicon.tsx';
import { useActiveChat } from './use-active-chat.ts';

const taskDetailPattern = /^\/tasks\/([^/]+)$/;
const automationEditPattern = /^\/automations\/edit\/([^/]+)$/;

/**
 * Location breadcrumb for the shell toolbar: the Tavern root, the current
 * section or chat, and a leaf for section subpages such as task and
 * automation editors. Chat crumbs reuse the tab favicon so a chat carries the
 * same identity mark in the tab, sidebar, and breadcrumb.
 */
export function ToolbarBreadcrumb() {
    const navigate = useNavigate();
    const location = useLocation();
    const { chat, descriptor } = useActiveChat();
    const leaf = useBreadcrumbLeaf(location.pathname);
    const isRoot =
        descriptor.kind === 'home' ||
        (descriptor.kind === 'section' && descriptor.section === 'overview');

    if (isRoot) {
        return (
            <nav aria-label="Breadcrumb" className={breadcrumbClassName}>
                <span className="text-muted-foreground">Home</span>
            </nav>
        );
    }

    return (
        <nav aria-label="Breadcrumb" className={breadcrumbClassName}>
            <button
                className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => navigate(appRoutes.overview)}
                type="button"
            >
                Home
            </button>
            <BreadcrumbArrow />
            {leaf ? (
                <>
                    <button
                        className="cursor-pointer truncate text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => navigate(leaf.sectionPath)}
                        type="button"
                    >
                        {descriptor.title}
                    </button>
                    <BreadcrumbArrow />
                    <span className="truncate text-foreground/85">{leaf.title}</span>
                </>
            ) : (
                <span className="flex min-w-0 items-center gap-1.5 text-foreground/85">
                    {chat ? (
                        <TavernTabFavicon
                            agentId={getChatAgentId(chat)}
                            busy={false}
                            color={chat.tabAppearance.color}
                            isChannel={chat.conversationKind === 'channel'}
                        />
                    ) : null}
                    <span className="truncate">{descriptor.title}</span>
                    {chat ? <AgentPresenceBadge chat={chat} /> : null}
                </span>
            )}
        </nav>
    );
}

interface BreadcrumbLeaf {
    sectionPath: string;
    title: string;
}

function useBreadcrumbLeaf(pathname: string): BreadcrumbLeaf | null {
    const taskId = pathname === appRoutes.newTask ? null : matchId(pathname, taskDetailPattern);
    const jobId = matchId(pathname, automationEditPattern);
    const tasksQuery = trpc.tasks.list.useQuery(undefined, {
        ...queryPolicy.agentRuntimeSnapshot,
        enabled: taskId !== null,
    });
    const cronQuery = trpc.cron.list.useQuery(undefined, {
        ...queryPolicy.agentRuntimeSnapshot,
        enabled: jobId !== null,
    });

    if (pathname === appRoutes.newTask) {
        return { sectionPath: appRoutes.tasks, title: 'New task' };
    }

    if (taskId) {
        const task = tasksQuery.data?.tasks.find((candidate) => candidate.id === taskId);
        return { sectionPath: appRoutes.tasks, title: task ? formatTaskNumber(task) : 'Task' };
    }

    if (pathname === appRoutes.newAutomation) {
        return { sectionPath: appRoutes.automations, title: 'New automation' };
    }

    if (jobId) {
        const job = cronQuery.data?.jobs.find((candidate) => candidate.id === jobId);
        return { sectionPath: appRoutes.automations, title: job?.name ?? 'Automation' };
    }

    return null;
}

function matchId(pathname: string, pattern: RegExp) {
    const match = pathname.match(pattern);

    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function BreadcrumbArrow() {
    return (
        <Icon
            aria-hidden="true"
            className="size-3 shrink-0 text-muted-foreground/60"
            icon={ArrowRight01Icon}
            size={12}
        />
    );
}

const breadcrumbClassName = 'flex min-w-0 items-center gap-1.5 pl-1 text-[13px]';
