import * as React from 'react';
import { Popover, PopoverPopup, PopoverTrigger } from '../../components/ui/popover.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useAgentActivity } from '../../hooks/agents/use-agent-activity.ts';
import { cn } from '../../lib/utils.ts';
import { formatAgentActivityEntry, formatAgentActivityTime } from './agent-activity-labels.ts';
import { useOpenAgentDrawer } from './agent-drawer-context.tsx';
import { AgentPresenceStatusLine } from './agent-presence.tsx';

const hoverCardEntryLimit = 5;

/**
 * Hover preview for any agent avatar (specs/agent-activity.md): live
 * presence plus the top activity entries. Clicking the avatar opens the
 * full agent drawer.
 */
export function AgentHoverCard({
    agentId,
    agentName,
    chatId,
    children,
    triggerClassName,
}: {
    agentId: string;
    agentName: string;
    chatId: string;
    children: React.ReactNode;
    triggerClassName?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const openAgentDrawer = useOpenAgentDrawer();

    return (
        <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger
                aria-label={`Agent details: ${agentName}`}
                className={triggerClassName}
                delay={350}
                onClick={() => {
                    setOpen(false);
                    openAgentDrawer({ agentId, agentName, chatId });
                }}
                openOnHover
                render={<button title={agentName} type="button" />}
            >
                {children}
            </PopoverTrigger>
            <PopoverPopup className="w-72 p-0" side="bottom">
                <AgentHoverCardBody agentId={agentId} agentName={agentName} enabled={open} />
            </PopoverPopup>
        </Popover>
    );
}

function AgentHoverCardBody({
    agentId,
    agentName,
    enabled,
}: {
    agentId: string;
    agentName: string;
    enabled: boolean;
}) {
    const activity = useAgentActivity({ agentId, enabled });
    const entries = (activity.data?.entries ?? []).slice(0, hoverCardEntryLimit);

    return (
        <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 truncate font-medium text-foreground text-sm">
                    {agentName}
                </span>
                <AgentPresenceStatusLine agentId={agentId} />
            </div>
            <div className="border-border/60 border-t px-3 py-2">
                <span className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wide">
                    Recent activity
                </span>
                {activity.isPending ? (
                    <span className="flex items-center gap-2 py-1.5 text-muted-foreground text-xs">
                        <Spinner className="size-3" />
                        Loading...
                    </span>
                ) : entries.length === 0 ? (
                    <p className="py-1.5 text-muted-foreground text-xs">No recent activity.</p>
                ) : (
                    <ul className="flex flex-col gap-1 py-1.5">
                        {entries.map((entry) => (
                            <li
                                className="flex min-w-0 items-baseline gap-2 text-xs"
                                key={`${entry.turnId ?? entry.at}-${entry.kind}`}
                            >
                                <span
                                    className={cn('shrink-0 text-muted-foreground/70 tabular-nums')}
                                >
                                    {formatAgentActivityTime(entry.at)}
                                </span>
                                <span className="min-w-0 truncate text-foreground/90">
                                    {formatAgentActivityEntry(entry)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
