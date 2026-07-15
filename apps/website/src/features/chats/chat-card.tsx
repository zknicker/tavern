import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/ui/message-scroller.tsx';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { getActiveRunIds } from './chat-active-runs.ts';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';
import { getChatCardDomId } from './chat-card-dom-id.ts';
import { ChatCardHeader } from './chat-card-header.tsx';
import type { ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import { ChatTurnTimeline, type ChatTurnTimelineMarker } from './chat-turn-timeline.tsx';

const chatSummaryLimit = 20;

export function ChatCard({
    agents,
    chat,
    highlighted,
    onArchive,
    onEdit,
}: {
    agents: AgentListOutput['agents'];
    chat: ChatListItem;
    highlighted: boolean;
    onArchive?: (() => void) | null;
    onEdit?: (() => void) | null;
}) {
    const timeline = useChatTimeline({
        chatId: chat.id,
        limit: chatSummaryLimit,
    });
    const rows = timeline.rows;
    const rowCount = rows.length;
    const totalMessages = timeline.totalMessages;
    const hasActiveReply = timeline.activeReplies.length > 0;
    const hasActiveTurn = timeline.activeTurns.length > 0 || hasActiveReply;
    const hasTimelineContent = rowCount > 0 || hasActiveReply || timeline.failedTurns.length > 0;
    const isInitialTranscriptPending =
        timeline.isPending && !timeline.historyLoaded && !hasActiveReply;
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const [turnTimelineMarkers, setTurnTimelineMarkers] = React.useState<ChatTurnTimelineMarker[]>(
        []
    );

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
                <ChatCardHeader chat={chat} onArchive={onArchive} onEdit={onEdit} />
            </div>

            <MessageScrollerProvider
                autoScroll={!isInitialTranscriptPending && hasTimelineContent}
                defaultScrollPosition="end"
            >
                <MessageScroller className="border-r-[3px] border-r-border/70">
                    <MessageScrollerViewport className="px-3 py-3" ref={viewportRef}>
                        {isInitialTranscriptPending ? null : hasTimelineContent ? (
                            <ChatTimeline
                                activeReplies={timeline.activeReplies}
                                failedTurns={timeline.failedTurns}
                                onTurnTimelineMarkersChange={setTurnTimelineMarkers}
                                rows={rows}
                                scrollContentRef={contentRef}
                                totalMessages={totalMessages}
                            />
                        ) : (
                            <div className="px-3 py-3 font-mono text-muted-foreground text-xs">
                                No synced messages for this chat yet.
                            </div>
                        )}
                    </MessageScrollerViewport>
                    <ChatTurnTimeline
                        anchorRef={viewportRef}
                        markers={
                            hasTimelineContent && !isInitialTranscriptPending
                                ? turnTimelineMarkers
                                : []
                        }
                    />
                </MessageScroller>
            </MessageScrollerProvider>

            <ChatActiveStatusStack
                activeReplies={timeline.activeReplies}
                agents={agents}
                rows={rows}
                turnEvidence={timeline.turnEvidence}
            />
            <ChatMessageComposer
                activeRunIds={getActiveRunIds(timeline)}
                agentRuntimeSyncLabel={chat.agentRuntimeSyncLabel}
                agents={agents}
                boundAgentIds={chat.boundAgentIds}
                canSend={chat.canSend}
                chatId={chat.id}
                conversationKind={chat.conversationKind}
                isDisabled={chat.isDisabled}
                isReplyActive={hasActiveTurn}
                variant="compact"
            />
        </div>
    );
}
