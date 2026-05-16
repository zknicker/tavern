import * as React from 'react';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import type { AgentListOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { getChatCardDomId } from './chat-card-dom-id.ts';
import { ChatCardHeader } from './chat-card-header.tsx';
import type { ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { getChatTimelineFollowKey } from './chat-timeline-follow-key.ts';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import { useChatScroll } from './use-chat-scroll.ts';

const chatSummaryLimit = 20;

export function ChatCard({
    agents,
    avatarDirectory,
    chat,
    highlighted,
    chatStatus,
    onArchive,
    onEdit,
}: {
    agents: AgentListOutput['agents'];
    avatarDirectory: DashboardAvatarDirectory;
    chat: ChatListItem;
    highlighted: boolean;
    chatStatus: ChatStatusListOutput['chats'][number] | null;
    onArchive?: (() => void) | null;
    onEdit?: (() => void) | null;
}) {
    const timeline = useChatTimeline({
        activeReply: chatStatus?.activeReply ?? null,
        activeReplyProgressStartedAt: chatStatus?.activeReplyProgressStartedAt ?? null,
        activeReplySteps: chatStatus?.activeReplySteps ?? [],
        chatId: chat.id,
        limit: chatSummaryLimit,
    });
    const rows = timeline.rows;
    const rowCount = rows.length;
    const totalRows = timeline.totalRows;
    const hasActiveReply = timeline.activeReply !== null;
    const hasTimelineContent = rowCount > 0 || hasActiveReply || timeline.failedTurn !== null;
    const isInitialTranscriptPending =
        timeline.isPending && !timeline.historyLoaded && !hasActiveReply;
    const followKey = getChatTimelineFollowKey({
        activeReply: timeline.activeReply,
        activeReplySteps: timeline.activeReplySteps,
        failedTurn: timeline.failedTurn,
    });
    const chatScroll = useChatScroll({
        enabled: !isInitialTranscriptPending && hasTimelineContent,
        followKey,
    });

    React.useEffect(() => {
        if (!timeline.error) {
            return;
        }

        console.error('Chat card timeline query failed', {
            chatId: chat.id,
            error: timeline.error,
        });
    }, [chat.id, timeline.error]);

    return (
        <div
            className={cn(
                'relative flex h-full min-h-0 w-[40.625rem] min-w-[40.625rem] flex-col overflow-hidden bg-card transition-shadow',
                highlighted ? 'bg-sky-500/5 shadow-lg shadow-sky-500/10' : null
            )}
            id={getChatCardDomId(chat.id)}
        >
            <ChatTranscriptLoadingIndicator
                className="absolute top-4 right-5 z-10"
                iconClassName="size-3.5"
                visible={isInitialTranscriptPending}
            />
            <div className="border-r-[3px] border-r-border-strong/80">
                <ChatCardHeader
                    avatarDirectory={avatarDirectory}
                    chat={chat}
                    onArchive={onArchive}
                    onEdit={onEdit}
                />
            </div>

            <div
                className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-r-[3px] border-r-border/70"
                onScroll={chatScroll.handleScroll}
                ref={chatScroll.viewportRef}
            >
                <div ref={chatScroll.contentRef}>
                    {isInitialTranscriptPending ? null : hasTimelineContent ? (
                        <ChatTimeline
                            activeReply={timeline.activeReply}
                            activeReplyProgressStartedAt={timeline.activeReplyProgressStartedAt}
                            activeReplySteps={timeline.activeReplySteps}
                            animate
                            completedProgress={timeline.completedProgress}
                            failedTurn={timeline.failedTurn}
                            rows={rows}
                            totalRows={totalRows}
                        />
                    ) : (
                        <div className="px-3 py-3 font-mono text-muted-foreground text-xs">
                            No synced messages for this chat yet.
                        </div>
                    )}
                </div>
            </div>

            <ChatMessageComposer
                agents={agents}
                chat={chat}
                isReplyActive={hasActiveReply}
                variant="compact"
            />
        </div>
    );
}
