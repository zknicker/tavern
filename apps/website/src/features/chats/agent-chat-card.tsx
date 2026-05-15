import { Link } from 'react-router-dom';
import { ChatTitle } from '../../components/chats/chat-title.tsx';
import { ChatTypeBadge } from '../../components/chats/chat-type-badge.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { cn } from '../../lib/utils.ts';
import { getActorNameClassName, getActorNameStyle } from '../rows/actor-color.ts';
import { type AgentChatPreviewLine, buildAgentChatPreview } from './agent-chat-preview.ts';
import { getChatCardDomId } from './chat-card-dom-id.ts';
import type { ChatListItem } from './chat-list-data.ts';
import { buildChatPath } from './chat-path.ts';

export function AgentChatCard({
    chat,
    highlighted,
    hasActiveReply,
}: {
    chat: ChatListItem;
    highlighted: boolean;
    hasActiveReply: boolean;
}) {
    const timeline = useChatTimeline({
        chatId: chat.id,
        limit: 8,
    });
    const previewLines = buildAgentChatPreview(timeline.rows);

    return (
        <Link
            className={cn(
                'group flex aspect-square flex-col rounded-xl border border-border bg-card transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                highlighted
                    ? 'bg-sky-500/5 shadow-lg shadow-sky-500/10 ring-2 ring-sky-300/80'
                    : null,
                hasActiveReply ? 'ring-1 ring-sky-200/80' : null
            )}
            id={getChatCardDomId(chat.id)}
            to={buildChatPath(chat.id)}
        >
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3.5 pb-1">
                <h2
                    className="min-w-0 truncate font-semibold text-foreground text-sm"
                    title={chat.title}
                >
                    <ChatTitle chat={chat} />
                </h2>
                <span className="flex shrink-0 items-center gap-1.5">
                    <ChatTypeBadge chat={chat} showDetail={false} />
                    {hasActiveReply ? (
                        <span className="inline-flex size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(74,222,128,0.12)]" />
                    ) : null}
                </span>
            </div>
            <p
                className="truncate px-4 text-muted-foreground text-xs"
                title={chat.latestSession?.sessionKey ?? chat.displayName}
            >
                {chat.latestSession?.sessionKey ?? chat.displayName} {chat.lastActivityLabel}
            </p>

            <div className="flex min-h-0 flex-1 flex-col justify-end px-4 pt-3 pb-3.5">
                {timeline.isPending ? (
                    <div className="space-y-2">
                        <Skeleton className="h-3.5 w-28 rounded-full" />
                        <Skeleton className="h-3.5 w-full rounded-full" />
                        <Skeleton className="h-3.5 w-4/5 rounded-full" />
                    </div>
                ) : previewLines.length > 0 ? (
                    <div className="space-y-1">
                        {previewLines.map((line) => (
                            <AgentChatPreviewRow key={line.id} line={line} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-border border-dashed px-3 py-3 text-muted-foreground text-xs">
                        No synced messages yet.
                    </div>
                )}
            </div>
        </Link>
    );
}

function AgentChatPreviewRow({ line }: { line: AgentChatPreviewLine }) {
    const actorProfile = useActorProfile(line.actor);
    const sender = actorProfile?.name ?? line.sender;

    return (
        <p className="flex items-baseline gap-2 text-xs leading-snug" title={line.content}>
            <span className="shrink-0 text-muted-foreground">{line.timeLabel}</span>
            <span
                className={cn(
                    'shrink-0 font-medium',
                    line.senderType === 'agent'
                        ? 'text-foreground'
                        : line.senderType === 'user'
                          ? getActorNameClassName({
                                actor: actorProfile,
                                fallbackName: sender,
                            })
                          : 'text-muted-foreground'
                )}
                style={line.senderType === 'user' ? getActorNameStyle(actorProfile) : undefined}
            >
                {sender}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">{line.content}</span>
        </p>
    );
}
