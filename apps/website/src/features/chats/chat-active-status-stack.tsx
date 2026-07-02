import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { getAgentStatusLabel, resolveAgentStatusExpression } from './agent-status-expression.ts';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';

interface ChatActiveStatusStackProps {
    activeReply: ChatActiveReply | null;
    agents: AgentListOutput['agents'];
    className?: string;
    rows: TranscriptRow[];
    variant?: 'compact' | 'detail';
}

export function ChatActiveStatusStack({
    activeReply,
    agents,
    className,
    rows,
    variant = 'compact',
}: ChatActiveStatusStackProps) {
    const activeItems = React.useMemo(
        () =>
            activeReply
                ? [
                      {
                          activeReply,
                          agent: agents.find((entry) => entry.id === activeReply.agentId) ?? null,
                      },
                  ]
                : [],
        [activeReply, agents]
    );

    if (activeItems.length === 0) {
        return null;
    }

    return (
        <section
            aria-label="Active agent status"
            className={cn(
                variant === 'compact'
                    ? 'border-r-[3px] border-r-border/70 bg-card px-5 pt-2 pb-1'
                    : 'bg-background px-6 pt-2 pb-1 lg:px-16',
                className
            )}
        >
            <div
                className={cn(
                    'mx-auto flex w-full max-w-[60rem] flex-col gap-1',
                    variant === 'detail' && 'px-0'
                )}
            >
                {activeItems.map((item) => (
                    <ChatActiveStatusItem
                        activeReply={item.activeReply}
                        agentCharacter={item.agent?.effectiveCharacter ?? null}
                        agentName={item.agent?.name ?? 'Agent'}
                        agentPrimaryColor={item.agent?.effectivePrimaryColor ?? null}
                        key={item.activeReply.runId}
                        rows={rows}
                    />
                ))}
            </div>
        </section>
    );
}

function ChatActiveStatusItem({
    activeReply,
    agentCharacter,
    agentName,
    agentPrimaryColor,
    rows,
}: {
    activeReply: ChatActiveReply;
    agentCharacter: AgentCharacter | null;
    agentName: string;
    agentPrimaryColor: string | null;
    rows: TranscriptRow[];
}) {
    return (
        <div className="flex h-8 min-w-0 items-center gap-2 text-muted-foreground/75 text-sm leading-5">
            <AgentStatusIndicator
                activeReply={activeReply}
                character={agentCharacter ?? 'none'}
                className="-ms-1"
                primaryColor={agentPrimaryColor}
                rows={rows}
                size={24}
            />
            <span className="thinking-indicator-text min-w-0 truncate">
                {formatActiveStatusText({ activeReply, agentName, rows })}
            </span>
        </div>
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
