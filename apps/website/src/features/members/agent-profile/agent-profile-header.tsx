import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Tooltip } from '../../../components/ui/tooltip.tsx';
import { useAgentChatList } from '../../../hooks/agents/use-agent-chats.ts';
import { useChatStop } from '../../../hooks/chats/use-chat-stop.ts';
import { useChatTimeline } from '../../../hooks/chats/use-chat-timeline.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { AgentFace } from '../../chats/agent-face.tsx';
import { resolveDmPresenceLabel, useAgentPresenceEntry } from '../../chats/agent-presence.tsx';
import { getActiveRunIds } from '../../chats/chat-active-runs.ts';
import { selectMostRecentAgentChat } from './agent-chat-selection.ts';
import { RestartAgentDialog } from './restart-agent-dialog.tsx';

type Agent = AgentListOutput['agents'][number];

export function AgentProfileHeader({
    agent,
    hostChatId,
    onClose,
    variant,
}: {
    agent: Agent;
    hostChatId?: string;
    onClose?: () => void;
    variant: 'page' | 'pane';
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const navigate = useNavigate();
    const chatsQuery = useAgentChatList({ agentId: agent.id });
    const directChat = selectMostRecentAgentChat(chatsQuery.data, 'direct');
    const presence = useAgentPresenceEntry(agent.id);
    const [restartOpen, setRestartOpen] = useState(false);
    // Judged from the host chat's seat: "Replying…" only when the work is in
    // the chat this profile is open in; "Working in <chat>…" everywhere else
    // (the Members page has no host chat).
    const presenceLabel = presence
        ? presence.state === 'busy'
            ? (resolveDmPresenceLabel(presence, hostChatId ?? '') ?? 'Working…')
            : 'Online'
        : 'Status unavailable';

    return (
        <>
            <header
                className={cn(
                    'flex shrink-0 items-center justify-between gap-4 border-[var(--content-card-border)] border-b',
                    variant === 'page' ? 'px-6 py-4' : 'px-4 py-3'
                )}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="flex size-14 shrink-0 items-center justify-center"
                    >
                        <AgentFace
                            animate={presence?.state === 'busy'}
                            dark={dark}
                            head={agent.effectiveCharacter}
                            ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                            size={variant === 'page' ? 52 : 44}
                        />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate font-bold text-foreground text-xl">{agent.name}</h1>
                        {agent.bio ? (
                            <p className="truncate text-muted-foreground text-sm">{agent.bio}</p>
                        ) : null}
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    presence?.state === 'busy'
                                        ? 'bg-warning'
                                        : presence
                                          ? 'bg-success'
                                          : 'bg-muted-foreground'
                                )}
                            />
                            <span className="truncate">{presenceLabel}</span>
                        </span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <ActionButton
                        disabled={!directChat}
                        icon={Message01Icon}
                        label={directChat ? 'Message' : 'No direct message chat yet'}
                        onClick={() => directChat && navigate(appRoutes.chat(directChat.id))}
                    />
                    {presence?.state === 'busy' && presence.chatId ? (
                        <AgentStopAction agentId={agent.id} chatId={presence.chatId} />
                    ) : (
                        <ActionButton
                            disabled
                            icon={StopIcon}
                            label="Agent is not working"
                            onClick={() => undefined}
                        />
                    )}
                    <ActionButton
                        icon={RefreshIcon}
                        label="Restart"
                        onClick={() => setRestartOpen(true)}
                    />
                    {onClose ? (
                        <ActionButton icon={Cancel01Icon} label="Close" onClick={onClose} />
                    ) : null}
                </div>
            </header>
            <RestartAgentDialog agent={agent} onOpenChange={setRestartOpen} open={restartOpen} />
        </>
    );
}

function AgentStopAction({ agentId, chatId }: { agentId: string; chatId: string }) {
    // Profiles can open before their busy chat has ever mounted. Hydrating its
    // newest log page supplies the active run needed by the Stop capability.
    const timeline = useChatTimeline({ chatId, limit: 1 });
    const stopTurn = useChatStop();
    const runId = selectAgentRunId(timeline, agentId);

    return (
        <ActionButton
            disabled={!runId || stopTurn.isPending}
            icon={StopIcon}
            label={runId ? 'Stop' : 'Loading active turn…'}
            onClick={() => {
                if (runId) {
                    stopTurn.mutate({ chatId, runId });
                }
            }}
        />
    );
}

function ActionButton({
    disabled = false,
    icon,
    label,
    onClick,
}: {
    disabled?: boolean;
    icon: Parameters<typeof Icon>[0]['icon'];
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip content={label}>
            <Button
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
                size="icon"
                title={label}
                variant="chrome"
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}

export function selectAgentRunId(
    timeline: {
        activeReplies: readonly { agentId: string; completedAt?: string | null; runId: string }[];
        activeTurns: readonly { agentId: string; runId: string }[];
    },
    agentId: string
) {
    const agentRunIds = new Set(
        [...timeline.activeTurns, ...timeline.activeReplies]
            .filter((turn) => turn.agentId === agentId)
            .map((turn) => turn.runId)
    );
    return getActiveRunIds(timeline).find((candidate) => agentRunIds.has(candidate)) ?? null;
}
