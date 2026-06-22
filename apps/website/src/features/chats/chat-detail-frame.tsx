import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { getChatTimelineFollowKey } from './chat-timeline-follow-key.ts';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import {
    ChatScrollControllerProvider,
    useChatScrollController,
} from './use-chat-scroll-controller.ts';

export function ChatDetailFrame({
    activeReply,
    agentPresenceColor = null,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    emptyLabel,
    enableVirtualization = true,
    error,
    fetchPreviousPage,
    failedTurn,
    footer,
    hasPreviousPage = false,
    historyLoaded,
    isFetchingPreviousPage = false,
    isPending,
    rows,
    totalMessages,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    chatId: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    emptyLabel: string;
    enableVirtualization?: boolean;
    error?: unknown;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    footer: React.ReactNode;
    hasPreviousPage?: boolean;
    historyLoaded: boolean;
    isFetchingPreviousPage?: boolean;
    isPending: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    totalMessages: number;
}) {
    const location = useLocation();
    const hasActiveReply = activeReply !== null;
    const hasTimelineContent = rows.length > 0 || hasActiveReply || failedTurn !== null;
    const isInitialTranscriptPending = isPending && !historyLoaded && !hasActiveReply;
    const followKey = getChatTimelineFollowKey({
        activeReply,
        failedTurn,
    });
    const initialScrollKey = isInitialTranscriptPending ? null : `${chatId}:${location.key}`;
    const chatScroll = useChatScrollController({
        enabled: !isInitialTranscriptPending && hasTimelineContent,
        followContentResizes: !enableVirtualization,
        followKey,
        initialScrollKey: enableVirtualization ? null : initialScrollKey,
        pinPassiveScrollDrift: !enableVirtualization,
    });
    // The scroll controller owns its own viewport listeners; this handler only
    // drives the non-virtualized previous-page fetch.
    const handleScroll = () => {
        const viewport = chatScroll.viewportRef.current;

        if (
            enableVirtualization ||
            !viewport ||
            viewport.scrollTop > 160 ||
            !hasPreviousPage ||
            isFetchingPreviousPage
        ) {
            return;
        }

        fetchPreviousPage?.();
    };
    return (
        <ChatScrollControllerProvider value={chatScroll.handle}>
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2">
                    <ChatTranscriptLoadingIndicator
                        className="shrink-0"
                        visible={isInitialTranscriptPending}
                    />
                </div>

                <div className="relative min-h-0 flex-1">
                    <div
                        className="h-full min-h-0 overflow-y-auto px-6 py-4 [scrollbar-gutter:stable]"
                        onScroll={handleScroll}
                        ref={chatScroll.viewportRef}
                    >
                        <div
                            className="mx-auto min-h-full w-full max-w-[60rem]"
                            ref={chatScroll.contentRef}
                        >
                            {isInitialTranscriptPending ? null : error ? (
                                <div className="px-2 py-4 text-muted-foreground text-sm">
                                    Unable to load this chat transcript right now.
                                </div>
                            ) : hasTimelineContent ? (
                                <ChatTimeline
                                    activeReply={activeReply}
                                    agentPresenceColor={agentPresenceColor}
                                    chatId={chatId}
                                    conversationLayout={conversationLayout}
                                    defaultOpenWorkGroups={defaultOpenWorkGroups}
                                    failedTurn={failedTurn}
                                    fetchPreviousPage={fetchPreviousPage}
                                    hasPreviousPage={hasPreviousPage}
                                    initialScrollKey={
                                        enableVirtualization ? initialScrollKey : null
                                    }
                                    isFetchingPreviousPage={isFetchingPreviousPage}
                                    rows={rows}
                                    scrollViewportRef={
                                        enableVirtualization ? chatScroll.viewportRef : undefined
                                    }
                                    totalMessages={totalMessages}
                                />
                            ) : (
                                <div className="px-2 py-4 text-muted-foreground text-sm">
                                    {emptyLabel}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {hasTimelineContent && !chatScroll.isAtBottom ? (
                    <div className="pointer-events-none relative z-10 flex justify-center">
                        <Button
                            aria-label="Jump to latest message"
                            className="pointer-events-auto -mt-11 rounded-full bg-background/92 shadow-black/10 shadow-lg backdrop-blur"
                            onClick={() => chatScroll.scrollToBottom()}
                            size="icon"
                            type="button"
                            variant="outline"
                        >
                            <Icon className="size-4" icon={ArrowDown01Icon} />
                        </Button>
                    </div>
                ) : null}

                {footer}
            </div>
        </ChatScrollControllerProvider>
    );
}
