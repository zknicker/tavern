import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { PromptInputButton } from '../../components/ui/prompt-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

interface AgentOption {
    id: string;
    name: string;
}

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
    const selectedAgent =
        boundAgents.find((agent) => agent.id === agentId) ?? boundAgents[0] ?? null;

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
                            <SelectValue placeholder="Choose agent">
                                {selectedAgent?.name}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {boundAgents.map((boundAgent) => (
                                <SelectItem key={boundAgent.id} value={boundAgent.id}>
                                    {boundAgent.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}
        </div>
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

function getAgentOption(agents: AgentListOutput['agents'], agentId: string): AgentOption {
    const agent = agents.find((entry) => entry.id === agentId);
    const name = agent?.name ?? agentId;

    return {
        id: agentId,
        name,
    };
}
