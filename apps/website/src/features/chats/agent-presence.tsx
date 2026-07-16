import { Clock } from '@hugeicons/core-free-icons';
import { AnimatePresence } from 'framer-motion';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgentPresence } from '../../hooks/agents/use-agent-presence.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-types.ts';
import type { AgentPresenceOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';
import { StatusRiseRow } from './chat-status-motion.tsx';

type AgentPresenceEntry = AgentPresenceOutput['presence'][number];

// Presence surfaces (specs/presence.md): one agent-scoped busy/idle fact
// rendered wherever the agent appears. "Replying here" stays the status
// stack's job; these surfaces answer "is the agent busy, and where".

/** Topbar presence for agent DMs: a quiet dot, plus text only when busy. */
export function AgentPresenceBadge({ chat }: { chat: ChatListItem }) {
    const presence = useAgentPresenceEntry(getChatAgentId(chat));
    if (chat.conversationKind === 'channel' || !presence) {
        return null;
    }
    const label = resolveDmPresenceLabel(presence, chat.id);

    return (
        <span className="flex min-w-0 items-center gap-1.5" data-slot="agent-presence">
            <AgentPresenceDot state={presence.state} />
            {label ? <span className="truncate text-muted-foreground text-xs">{label}</span> : null}
        </span>
    );
}

/**
 * Composer hint: a seated agent is busy with a turn anchored in another
 * chat, so a send here queues. Hidden the moment a turn runs in this chat —
 * the active status stack takes over.
 */
export function AgentBusyElsewhereHint({
    activeReplies,
    boundAgentIds,
    chat,
}: {
    activeReplies: readonly ChatActiveReply[];
    boundAgentIds: readonly string[];
    chat: ChatListItem;
}) {
    const { data } = useAgentPresence();
    const busyElsewhere = resolveBusyElsewhere({
        boundAgentIds,
        chatId: chat.id,
        presence: data?.presence ?? [],
    });
    const agentName = busyElsewhere
        ? (chat.participants.find((participant) => participant.actorId === busyElsewhere.agentId)
              ?.name ?? 'The agent')
        : null;

    const visible =
        busyElsewhere !== null &&
        !activeReplies.some((reply) => reply.agentId === busyElsewhere.agentId);

    // Mirror the composer's gutters and centered column (PromptInput's
    // form px-6 lg:px-16 + max-w-[60rem]) so the hint sits flush with the
    // prompt bar's left edge. The gutters stay static (zero height while
    // hidden); only the content row rises, so its scale anchors at the
    // column's left edge instead of lurching from the viewport edge.
    return (
        <div className="px-6 lg:px-16" data-slot="agent-busy-elsewhere">
            <div className="mx-auto w-full max-w-[60rem]">
                <AnimatePresence initial={false}>
                    {visible ? (
                        <StatusRiseRow key={busyElsewhere.agentId}>
                            <div className="flex items-center gap-1.5 px-1 pb-1.5 text-muted-foreground text-xs">
                                <Icon
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0"
                                    icon={Clock}
                                />
                                <span className="min-w-0 truncate">
                                    {agentName} is busy{formatWhere(busyElsewhere)} — your message
                                    is queued and answers next
                                </span>
                            </div>
                        </StatusRiseRow>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}

/** Presence dot for sidebar DM rows, anchored to the agent face. */
export function SidebarAgentPresenceDot({ chat }: { chat: ChatListItem }) {
    const presence = useAgentPresenceEntry(
        chat.conversationKind === 'channel' ? null : getChatAgentId(chat)
    );
    if (!presence) {
        return null;
    }

    return (
        <AgentPresenceDot
            className="absolute -right-0.5 -bottom-0.5 border-2 border-sidebar"
            state={presence.state}
        />
    );
}

export function resolveDmPresenceLabel(presence: AgentPresenceEntry, chatId: string) {
    if (presence.state !== 'busy') {
        return null;
    }
    if (presence.chatId === chatId) {
        return 'Replying…';
    }
    return `Working in ${presence.chatTitle ?? 'another chat'}…`;
}

export function resolveBusyElsewhere(input: {
    boundAgentIds: readonly string[];
    chatId: string;
    presence: readonly AgentPresenceEntry[];
}) {
    const seated = new Set(input.boundAgentIds);
    return (
        input.presence.find(
            (entry) =>
                seated.has(entry.agentId) &&
                entry.state === 'busy' &&
                entry.chatId !== null &&
                entry.chatId !== input.chatId
        ) ?? null
    );
}

function formatWhere(presence: AgentPresenceEntry) {
    return presence.chatTitle ? ` in ${presence.chatTitle}` : ' in another chat';
}

function AgentPresenceDot({
    className,
    state,
}: {
    className?: string;
    state: AgentPresenceEntry['state'];
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'size-2 shrink-0 rounded-full transition-colors duration-300',
                state === 'busy' ? 'bg-warning' : 'bg-success',
                className
            )}
            data-state={state}
        />
    );
}

/** Generic presence line: dot always, label only while busy. */
export function AgentPresenceStatusLine({ agentId }: { agentId: string }) {
    const presence = useAgentPresenceEntry(agentId);
    if (!presence) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <AgentPresenceDot state={presence.state} />
            {presence.state === 'busy' ? (
                <span className="truncate text-muted-foreground text-xs">
                    {`Working in ${presence.chatTitle ?? 'another chat'}…`}
                </span>
            ) : null}
        </span>
    );
}

/** The agent's presence entry, or null while unknown. */
export function useAgentPresenceEntry(agentId: string | null) {
    const { data } = useAgentPresence();
    if (!agentId) {
        return null;
    }
    return data?.presence.find((entry) => entry.agentId === agentId) ?? null;
}
