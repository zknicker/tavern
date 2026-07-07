import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerProvider,
    MessageScrollerViewport,
    useMessageScroller,
} from '../../components/ui/message-scroller.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatScrollPositionMemory } from './chat-scroll-position-memory.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import { ChatTurnTimeline, type ChatTurnTimelineMarker } from './chat-turn-timeline.tsx';

export function ChatDetailFrame({
    activeReplies,
    agentStatusCharacter = null,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    emptyLabel,
    error,
    artifactPanel,
    fetchOlderHistory,
    failedTurns,
    footer,
    hasOlderHistory = false,
    header,
    historyLoaded,
    isFetchingOlderHistory = false,
    isPending,
    rows,
    totalMessages,
}: {
    activeReplies: readonly ChatActiveReply[];
    agentStatusCharacter?: AgentCharacter | null;
    chatId: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    emptyLabel: string;
    error?: unknown;
    artifactPanel?: React.ReactNode;
    fetchOlderHistory?: () => void;
    failedTurns?: readonly ChatTurnFailure[];
    footer: React.ReactNode;
    hasOlderHistory?: boolean;
    header?: React.ReactNode;
    historyLoaded: boolean;
    isFetchingOlderHistory?: boolean;
    isPending: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    totalMessages: number;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [turnTimelineMarkers, setTurnTimelineMarkers] = React.useState<ChatTurnTimelineMarker[]>(
        []
    );
    const hasActiveReply = activeReplies.length > 0;
    const hasTimelineContent = rows.length > 0 || hasActiveReply || (failedTurns?.length ?? 0) > 0;
    const isInitialTranscriptPending = isPending && !historyLoaded && !hasActiveReply;
    const handleScroll = () => {
        const viewport = viewportRef.current;

        if (!viewport || viewport.scrollTop > 160 || !hasOlderHistory || isFetchingOlderHistory) {
            return;
        }

        fetchOlderHistory?.();
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
                                // Widen the side gutters at lg+ so the turn
                                // timeline rail has room beside the messages;
                                // the rail itself hides below lg. The deep
                                // bottom padding (272px) reserves breathing
                                // room under the last message so the
                                // transcript never crowds the composer.
                                className="px-6 pt-4 pb-68 lg:px-16"
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
                                        activeReplies={activeReplies}
                                        agentStatusCharacter={agentStatusCharacter}
                                        chatId={chatId}
                                        conversationLayout={conversationLayout}
                                        defaultOpenWorkGroups={defaultOpenWorkGroups}
                                        failedTurns={failedTurns}
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
                            <TurnStartAutoScroll
                                activeRunId={activeReplies.at(-1)?.runId ?? null}
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

// Reveal a turn the moment it starts. Turns kicked off by a composer send are
// already anchored by the new user-message item (scrolled to the top with the
// spacer filling the viewport below) — scrolling then would collapse that
// anchor, so the visible spacer opts out. This covers turns that start without
// a new user message: simulated turns, cron deliveries, and channel triggers
// from other participants.
function TurnStartAutoScroll({
    activeRunId,
    viewportRef,
}: {
    activeRunId: string | null;
    viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const { scrollToEnd } = useMessageScroller();
    const lastRunIdRef = React.useRef<string | null>(activeRunId);
    // Latest-callback ref: keeps the effect off the scroller context's
    // per-render callback identity so the scheduled frame survives re-renders.
    const scrollToEndRef = React.useRef(scrollToEnd);
    scrollToEndRef.current = scrollToEnd;

    React.useEffect(() => {
        if (!activeRunId || lastRunIdRef.current === activeRunId) {
            lastRunIdRef.current = activeRunId;
            return;
        }

        lastRunIdRef.current = activeRunId;
        // Synchronous on purpose: requestAnimationFrame never fires in
        // hidden windows.
        const viewport = viewportRef.current;
        const distanceFromEnd = viewport
            ? viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
            : 0;

        // Already at the end (including the send-anchored position, where the
        // spacer keeps the anchored message "at end"): scrolling would only
        // disturb the anchored mode.
        if (distanceFromEnd <= 4) {
            return;
        }

        scrollToEndRef.current({
            // Hidden windows never animate smooth scrolls; jump instead.
            behavior: document.visibilityState === 'hidden' ? 'auto' : 'smooth',
        });
    }, [activeRunId, viewportRef]);

    return null;
}
