import { Plus } from '@hugeicons/core-free-icons';
import { AgentAvatar } from '@tavern/agent-avatars';
import * as React from 'react';
import { ChatComposer } from '../../components/ui/chat-composer.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { Mention } from '../mentions/mention-types.ts';
import { useMentionComposer } from '../mentions/use-mention-composer.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';

interface AgentOption {
    avatar: string;
    id: string;
    name: string;
    primaryColor: string;
}

export function ChatMessageComposerSurface({
    agentId,
    agents,
    boundAgentIds,
    canSubmit,
    content,
    contextFullness,
    disabled,
    error,
    name,
    onAgentChange,
    onMentionsChange,
    onSubmit,
    onTextChange,
    placeholder,
    variant = 'detail',
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    boundAgentIds: string[];
    canSubmit: boolean;
    content: string;
    contextFullness: ChatContextFullness | null;
    disabled: boolean;
    error?: React.ReactNode;
    name: string;
    onAgentChange: (agentId: string) => void;
    onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
    onMentionsChange?: (mentions: Mention[]) => void;
    onTextChange: (content: string) => void;
    placeholder: string;
    variant?: ChatMessageComposerVariant;
}) {
    const boundAgents = React.useMemo(
        () => boundAgentIds.map((boundAgentId) => getAgentOption(agents, boundAgentId)),
        [agents, boundAgentIds]
    );
    const isCompact = variant === 'compact';
    const mentionComposer = useMentionComposer({
        agentId,
        agents,
        content,
        onTextChange,
        onSubmit: () => {
            void onSubmit();
        },
        onMentionsChange,
    });

    return (
        <ChatComposer
            canSubmit={canSubmit}
            className={cn(
                isCompact
                    ? 'border-t border-r-[3px] border-r-border/70 bg-chrome/40 px-3 py-3'
                    : null
            )}
            composerPopover={mentionComposer.composerPopover}
            contentClassName={isCompact ? 'max-w-none' : undefined}
            disabled={disabled}
            error={error}
            footerEnd={
                contextFullness ? <ContextFullnessIndicator fullness={contextFullness} /> : null
            }
            footerStart={
                <AgentSelector
                    agentId={agentId}
                    boundAgentIds={boundAgentIds}
                    boundAgents={boundAgents}
                    onAgentChange={onAgentChange}
                />
            }
            name={name}
            onSubmit={(event) => {
                void onSubmit(event);
            }}
            onTextChange={(value) => onTextChange(value)}
            onTextEditorFocus={mentionComposer.focusTextEditor}
            placeholder={placeholder}
            surfaceClassName={isCompact ? 'rounded-2xl shadow-none' : undefined}
            textareaRows={isCompact ? 2 : undefined}
            textEditor={mentionComposer.renderTextEditor({
                disabled,
                name,
                placeholder,
            })}
            value={content}
        />
    );
}

function AgentSelector({
    agentId,
    boundAgentIds,
    boundAgents,
    onAgentChange,
}: {
    agentId: string;
    boundAgentIds: string[];
    boundAgents: AgentOption[];
    onAgentChange: (agentId: string) => void;
}) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <Button
                aria-label="Attach file"
                disabled
                size="icon-sm"
                title="Attachments are not available for sending yet."
                type="button"
                variant="ghost"
            >
                <Icon icon={Plus} />
            </Button>
            {boundAgentIds.length > 1 ? (
                <div className="min-w-0">
                    <Select
                        onValueChange={(value) => value && onAgentChange(value)}
                        value={agentId}
                    >
                        <SelectTrigger
                            aria-label="Choose agent"
                            className="h-9 min-w-0 rounded-full border-transparent bg-muted/75 py-1 pr-2 pl-1.5 shadow-none ring-1 ring-border/35 hover:bg-accent"
                            size="sm"
                        >
                            <SelectValue className="sr-only" placeholder="Choose agent" />
                            <AgentAvatarCluster agents={boundAgents} selectedAgentId={agentId} />
                        </SelectTrigger>
                        <SelectContent>
                            {boundAgents.map((boundAgent) => (
                                <SelectItem key={boundAgent.id} value={boundAgent.id}>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <AgentAvatar
                                            avatar={boundAgent.avatar}
                                            backgroundColor={boundAgent.primaryColor}
                                            className="size-5 shrink-0"
                                            name={boundAgent.name}
                                        />
                                        <span className="min-w-0 truncate">{boundAgent.name}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}
        </div>
    );
}

function AgentAvatarCluster({
    agents,
    selectedAgentId,
}: {
    agents: AgentOption[];
    selectedAgentId: string;
}) {
    return (
        <div className="flex min-w-0 items-center -space-x-1.5">
            {agents.map((agent) => (
                <AgentAvatar
                    avatar={agent.avatar}
                    backgroundColor={agent.primaryColor}
                    className={cn(
                        'size-7 shrink-0 rounded-full ring-2 ring-popover',
                        agent.id === selectedAgentId ? 'z-10' : 'opacity-88'
                    )}
                    key={agent.id}
                    name={agent.name}
                />
            ))}
        </div>
    );
}

function ContextFullnessIndicator({ fullness }: { fullness: ChatContextFullness }) {
    const radius = 7;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - fullness.percent);
    const percentLabel = `${Math.round(fullness.percent * 100)}%`;

    return (
        <div
            className="flex items-center gap-2 text-muted-foreground text-sm"
            title={`${percentLabel} context used`}
        >
            <svg aria-hidden="true" className="size-5 -rotate-90" viewBox="0 0 20 20">
                <circle
                    className="stroke-muted"
                    cx="10"
                    cy="10"
                    fill="none"
                    r={radius}
                    strokeWidth="3"
                />
                <circle
                    className="stroke-muted-foreground/70"
                    cx="10"
                    cy="10"
                    fill="none"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth="3"
                />
            </svg>
            <span className="font-medium text-foreground text-sm tabular-nums">{percentLabel}</span>
        </div>
    );
}

function getAgentOption(agents: AgentListOutput['agents'], agentId: string): AgentOption {
    const agent = agents.find((entry) => entry.id === agentId);
    const name = agent?.name ?? agentId;

    return {
        avatar: agent?.avatar ?? fallbackAvatar(name),
        id: agentId,
        name,
        primaryColor: agent?.effectivePrimaryColor ?? '#64748b',
    };
}

function fallbackAvatar(value: string) {
    return value.trim().slice(0, 1).toUpperCase() || '?';
}
