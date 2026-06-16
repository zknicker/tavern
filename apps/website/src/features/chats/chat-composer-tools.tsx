import { Plus } from '@hugeicons/core-free-icons';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { ModelOptionItem } from '../../components/ui/model-route-shared.ts';
import { PromptInputButton } from '../../components/ui/prompt-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { ChatContextFullness } from './chat-context-fullness.ts';

interface AgentOption {
    avatar: string;
    id: string;
    name: string;
    primaryColor: string;
}

export const defaultComposerModelValue = '__agent_default__';

export function ChatComposerAttachmentButton({
    disabled,
    onClick,
}: {
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <PromptInputButton
            aria-label="Attach file"
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            tooltip={disabled ? 'Attachments are not available right now.' : 'Attach file'}
            type="button"
            variant="ghost"
        >
            <Icon icon={Plus} />
        </PromptInputButton>
    );
}

export function ChatComposerAgentSelector({
    agentId,
    agents,
    boundAgentIds,
    disabled = false,
    onAgentChange,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    boundAgentIds: string[];
    disabled?: boolean;
    onAgentChange: (agentId: string) => void;
}) {
    const boundAgents = boundAgentIds.map((boundAgentId) => getAgentOption(agents, boundAgentId));

    return (
        <div className="flex min-w-0 items-center gap-2">
            {boundAgentIds.length > 1 ? (
                <div className="min-w-0">
                    <Select
                        disabled={disabled}
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

export function ChatComposerModelSelector({
    disabled,
    modelOptions,
    onModelChange,
    value,
}: {
    disabled?: boolean;
    modelOptions: readonly ModelOptionItem[];
    onModelChange: (modelRef: string | null) => void;
    value: string | null;
}) {
    return (
        <Select
            disabled={disabled}
            onValueChange={(nextValue) =>
                onModelChange(nextValue === defaultComposerModelValue ? null : nextValue)
            }
            value={value ?? defaultComposerModelValue}
        >
            <SelectTrigger
                aria-label="Choose model"
                className="h-9 max-w-[11rem] rounded-full border-transparent bg-muted/75 px-3 shadow-none ring-1 ring-border/35 hover:bg-accent"
                size="sm"
            >
                <SelectValue placeholder="Agent default" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={defaultComposerModelValue}>Agent default</SelectItem>
                {modelOptions.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                        {model.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function ChatComposerContextFullness({ fullness }: { fullness: ChatContextFullness }) {
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

function getAgentOption(agents: AgentListOutput['agents'], agentId: string): AgentOption {
    const agent = agents.find((entry) => entry.id === agentId);
    const name = agent?.name ?? agentId;

    return {
        avatar: fallbackAvatar(name),
        id: agentId,
        name,
        primaryColor: agent?.effectivePrimaryColor ?? '#64748b',
    };
}

function fallbackAvatar(value: string) {
    return value.trim().slice(0, 1).toUpperCase() || '?';
}
