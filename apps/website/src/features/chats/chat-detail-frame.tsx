import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/ui/message-scroller.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatScrollPositionMemory } from './chat-scroll-position-memory.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import { ChatTurnTimeline, type ChatTurnTimelineMarker } from './chat-turn-timeline.tsx';

export function ChatDetailFrame({
    activeReply,
    agentStatusColor = null,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    emptyLabel,
    error,
    artifactPanel,
    fetchPreviousPage,
    failedTurn,
    footer,
    hasPreviousPage = false,
    header,
    historyLoaded,
    isFetchingPreviousPage = false,
    isPending,
    rows,
    totalMessages,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusColor?: string | null;
    chatId: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    emptyLabel: string;
    error?: unknown;
    artifactPanel?: React.ReactNode;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    footer: React.ReactNode;
    hasPreviousPage?: boolean;
    header?: React.ReactNode;
    historyLoaded: boolean;
    isFetchingPreviousPage?: boolean;
    isPending: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    totalMessages: number;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [turnTimelineMarkers, setTurnTimelineMarkers] = React.useState<ChatTurnTimelineMarker[]>(
        []
    );
    const hasActiveReply = activeReply !== null;
    const hasTimelineContent = rows.length > 0 || hasActiveReply || failedTurn !== null;
    const isInitialTranscriptPending = isPending && !historyLoaded && !hasActiveReply;
    const handleScroll = () => {
        const viewport = viewportRef.current;

        if (!viewport || viewport.scrollTop > 160 || !hasPreviousPage || isFetchingPreviousPage) {
            return;
        }

        fetchPreviousPage?.();
    };

    return (
        <MessageScrollerProvider
            autoScroll={hasTimelineContent}
            defaultScrollPosition="end"
            scrollPreviousItemPeek={64}
        >
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    {header}
                    <div className="relative min-h-0 flex-1">
                        <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2">
                            <ChatTranscriptLoadingIndicator
                                className="shrink-0"
                                visible={isInitialTranscriptPending}
                            />
                        </div>
                        <MessageScroller>
                            <MessageScrollerViewport
                                className="px-6 py-4"
                                onScroll={handleScroll}
                                ref={viewportRef}
                            >
                                {isInitialTranscriptPending ? null : error ? (
                                    <MessageScrollerContent className="mx-auto w-full max-w-[60rem]">
                                        <div className="px-2 py-4 text-muted-foreground text-sm">
                                            Unable to load this chat transcript right now.
                                        </div>
                                    </MessageScrollerContent>
                                ) : hasTimelineContent ? (
                                    <ChatTimeline
                                        activeReply={activeReply}
                                        agentStatusColor={agentStatusColor}
                                        chatId={chatId}
                                        conversationLayout={conversationLayout}
                                        defaultOpenWorkGroups={defaultOpenWorkGroups}
                                        failedTurn={failedTurn}
                                        onTurnTimelineMarkersChange={setTurnTimelineMarkers}
                                        rows={rows}
                                        scrollContentRef={contentRef}
                                        totalMessages={totalMessages}
                                    />
                                ) : (
                                    <MessageScrollerContent className="mx-auto w-full max-w-[60rem]">
                                        <div className="px-2 py-4 text-muted-foreground text-sm">
                                            {emptyLabel}
                                        </div>
                                    </MessageScrollerContent>
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
                            <ChatScrollPositionMemory
                                chatId={chatId}
                                enabled={hasTimelineContent && !isInitialTranscriptPending}
                                key={chatId}
                                viewportRef={viewportRef}
                            />
                            {hasTimelineContent ? (
                                <MessageScrollerButton
                                    aria-label="Jump to latest message"
                                    className="z-10"
                                    direction="end"
                                    size="icon-sm"
                                    variant="secondary"
                                />
                            ) : null}
                        </MessageScroller>
                    </div>

                    {footer}
                </div>
                {artifactPanel}
            </div>
        </MessageScrollerProvider>
    );
}
