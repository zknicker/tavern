import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import type { ChatActiveReply, ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { getAgentStatusLabel, resolveAgentStatusExpression } from './agent-status-expression.ts';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';
import {
    findActiveTurnEntry,
    findLastAgentTurnEntry,
    formatTurnWorkSummary,
} from './chat-active-turn.ts';
import { getWorkGroupIcon, isActivityItem } from './chat-transcript-activity-utils.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { ChatTurnDrawer } from './chat-turn-drawer.tsx';
import { useStableWorkGroupLabel, WorkGroupHeaderText } from './work-group-header-text.tsx';

interface ChatActiveStatusStackProps {
    activeReplies: readonly ChatActiveReply[];
    agents: AgentListOutput['agents'];
    chatId?: string;
    className?: string;
    rows: TranscriptRow[];
    // Live execution evidence keyed by run — work summaries and the live
    // drawer read from it, since execution rows never ride the timeline
    // (specs/chat-timeline.md).
    turnEvidence?: ChatTimelineState['turnEvidence'];
    variant?: 'compact' | 'detail';
}

// One status row per live run: each agent seat runs one turn at a time, so
// concurrent rows belong to different agents.
export function ChatActiveStatusStack({
    activeReplies,
    agents,
    chatId,
    className,
    rows,
    turnEvidence = {},
    variant = 'compact',
}: ChatActiveStatusStackProps) {
    const [drawerRunId, setDrawerRunId] = React.useState<string | null>(null);
    const rowsWithEvidence = React.useMemo(() => {
        const evidence = Object.values(turnEvidence).flat();

        return evidence.length > 0 ? [...rows, ...evidence] : rows;
    }, [rows, turnEvidence]);
    const drawerReply = drawerRunId
        ? (activeReplies.find((reply) => reply.runId === drawerRunId) ?? null)
        : null;
    const drawerAgent = drawerReply
        ? (agents.find((entry) => entry.id === drawerReply.agentId) ?? null)
        : null;
    // The turn drawer must outlive the status row: if it is open when its
    // turn completes, it keeps showing the same turn (and the same agent
    // identity) from its durable rows instead of vanishing mid-read.
    const lastAgentRef = React.useRef<{
        character: AgentCharacter | null;
        color: string | null;
        name: string;
    }>({ character: null, color: null, name: 'Agent' });

    if (drawerAgent) {
        lastAgentRef.current = {
            character: drawerAgent.effectiveCharacter ?? null,
            color: drawerAgent.effectivePrimaryColor ?? null,
            name: drawerAgent.name,
        };
    }

    const drawerEntry = React.useMemo(() => {
        if (!drawerRunId) {
            return null;
        }

        return (
            findActiveTurnEntry({ activeReplies, rows: rowsWithEvidence, runId: drawerRunId }) ??
            findLastAgentTurnEntry({ rows: rowsWithEvidence, runId: drawerRunId })
        );
    }, [activeReplies, drawerRunId, rowsWithEvidence]);
    const drawerAgentName = drawerAgent?.name ?? lastAgentRef.current.name;
    const drawerAgentCharacter = drawerAgent?.effectiveCharacter ?? lastAgentRef.current.character;
    const drawerAgentColor = drawerAgent?.effectivePrimaryColor ?? lastAgentRef.current.color;

    // The detail surface floats this stack over the transcript's reserved
    // bottom padding (ChatDetailFooter), so appearing and disappearing rows
    // never resize the scroller viewport or move the reader.
    const hasActiveReplies = activeReplies.length > 0;

    return (
        <>
            {hasActiveReplies ? (
                <section
                    aria-label="Active agent status"
                    className={cn(
                        variant === 'compact'
                            ? 'border-r-[3px] border-r-border/70 bg-card px-5 pt-2 pb-1'
                            : // Fades toward the transcript so scrolled content
                              // slides under it without a hard seam above the
                              // composer.
                              'bg-gradient-to-t from-background via-background/85 to-transparent px-6 pt-3 pb-1 lg:px-16',
                        className
                    )}
                >
                    <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-1">
                        {activeReplies.map((reply) => (
                            <ChatActiveStatusRow
                                activeReplies={activeReplies}
                                agents={agents}
                                key={reply.runId}
                                onViewDetails={() => setDrawerRunId(reply.runId)}
                                reply={reply}
                                rows={rowsWithEvidence}
                            />
                        ))}
                    </div>
                </section>
            ) : null}
            <ChatTurnDrawer
                agentCharacter={drawerAgentCharacter}
                agentColor={drawerAgentColor}
                agentName={drawerAgentName}
                chatId={chatId}
                entry={drawerEntry}
                onOpenChange={(open) => {
                    if (!open) {
                        setDrawerRunId(null);
                    }
                }}
                open={drawerRunId !== null}
                turnActive={drawerReply !== null}
            />
        </>
    );
}

function ChatActiveStatusRow({
    activeReplies,
    agents,
    onViewDetails,
    reply,
    rows,
}: {
    activeReplies: readonly ChatActiveReply[];
    agents: AgentListOutput['agents'];
    onViewDetails: () => void;
    reply: ChatActiveReply;
    rows: TranscriptRow[];
}) {
    const agent = agents.find((entry) => entry.id === reply.agentId) ?? null;
    const turnEntry = React.useMemo(
        () => findActiveTurnEntry({ activeReplies, rows, runId: reply.runId }),
        [activeReplies, reply.runId, rows]
    );

    return (
        <ChatActiveStatusItem
            activeReply={reply}
            agentCharacter={agent?.effectiveCharacter ?? null}
            agentName={agent?.name ?? 'Agent'}
            agentPrimaryColor={agent?.effectivePrimaryColor ?? null}
            onViewDetails={onViewDetails}
            rows={rows}
            workIcon={getWorkGroupIcon(turnEntry?.items.filter(isActivityItem) ?? [])}
            workSummary={formatTurnWorkSummary(turnEntry)}
        />
    );
}

function ChatActiveStatusItem({
    activeReply,
    agentCharacter,
    agentName,
    agentPrimaryColor,
    onViewDetails,
    rows,
    workIcon,
    workSummary,
}: {
    activeReply: ChatActiveReply;
    agentCharacter: AgentCharacter | null;
    agentName: string;
    agentPrimaryColor: string | null;
    onViewDetails: () => void;
    rows: TranscriptRow[];
    workIcon: React.ComponentProps<typeof Icon>['icon'] | null;
    workSummary: string | null;
}) {
    // Dwell between summary changes so fast tool bursts read as discrete
    // updates; label changes roll in with the drawers' slot-text treatment.
    const stableSummary = useStableWorkGroupLabel(workSummary, true);

    return (
        <button
            className="group/status flex h-8 min-w-0 cursor-pointer items-center gap-2 text-left text-muted-foreground/75 text-sm leading-5 transition-colors hover:text-muted-foreground"
            onClick={onViewDetails}
            title="View turn details"
            type="button"
        >
            <AgentStatusIndicator
                activeReply={activeReply}
                character={agentCharacter ?? 'none'}
                className="-ms-1"
                primaryColor={agentPrimaryColor}
                rows={rows}
                size={24}
            />
            <span className="thinking-indicator-text min-w-0 shrink-0 leading-5">
                {formatActiveStatusText({ activeReply, agentName, rows })}
            </span>
            {stableSummary ? (
                <span className="flex h-5 min-w-0 items-center gap-1.5 text-muted-foreground/60 leading-5 transition-colors group-hover/status:text-muted-foreground/80">
                    {workIcon ? (
                        <Icon className="size-3.5 shrink-0" icon={workIcon} strokeWidth={1.5} />
                    ) : null}
                    <WorkGroupHeaderText isActive label={stableSummary} />
                </span>
            ) : null}
        </button>
    );
}

function formatActiveStatusText({
    activeReply,
    agentName,
    rows,
}: {
    activeReply: ChatActiveReply;
    agentName: string;
    rows: TranscriptRow[];
}) {
    const emotion = resolveAgentStatusExpression({
        activeReply,
        rows,
    });
    const label = getAgentStatusLabel(emotion).replace(/^Agent\b/, agentName);

    return label.endsWith('working') || label.endsWith('thinking') || label.endsWith('replying')
        ? `${label}...`
        : label;
}
