import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { AppShellContentHeader } from '../../components/ui/app-shell.tsx';
import { BreadcrumbTrail } from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { getChatTimelineFollowKey } from './chat-timeline-follow-key.ts';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import { useChatScroll } from './use-chat-scroll.ts';

export function ChatDetailFrame({
    activeReply,
    animateTimeline = true,
    chatId,
    conversationLayout,
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
    title,
    totalRows,
}: {
    activeReply: ChatActiveReply | null;
    animateTimeline?: boolean;
    chatId: string;
    conversationLayout?: ConversationMessageLayout;
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
    title: string;
    totalRows: number;
}) {
    const hasActiveReply = activeReply !== null;
    const hasTimelineContent = rows.length > 0 || hasActiveReply || failedTurn !== null;
    const isInitialTranscriptPending = isPending && !historyLoaded && !hasActiveReply;
    const followKey = getChatTimelineFollowKey({
        activeReply,
        failedTurn,
    });
    const chatScroll = useChatScroll({
        enabled: !isInitialTranscriptPending && hasTimelineContent,
        followKey,
    });
    const handleScroll = () => {
        chatScroll.handleScroll();

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
        <div className="flex min-h-0 flex-1 flex-col">
            <AppShellContentHeader>
                <BreadcrumbTrail
                    items={[{ label: 'Chats', to: '/dashboard/chats' }, { label: title }]}
                />
                <ChatTranscriptLoadingIndicator
                    className="shrink-0"
                    visible={isInitialTranscriptPending}
                />
            </AppShellContentHeader>

            <div className="relative min-h-0 flex-1">
                <div
                    className="h-full min-h-0 overflow-y-auto px-6 py-4"
                    onScroll={handleScroll}
                    ref={chatScroll.viewportRef}
                >
                    <div
                        className="mx-auto min-h-full w-full max-w-[46rem]"
                        ref={chatScroll.contentRef}
                    >
                        {isInitialTranscriptPending ? null : error ? (
                            <div className="px-2 py-4 text-muted-foreground text-sm">
                                Unable to load this chat transcript right now.
                            </div>
                        ) : hasTimelineContent ? (
                            <ChatTimeline
                                activeReply={activeReply}
                                animate={animateTimeline}
                                chatId={chatId}
                                conversationLayout={conversationLayout}
                                failedTurn={failedTurn}
                                fetchPreviousPage={fetchPreviousPage}
                                hasPreviousPage={hasPreviousPage}
                                isFetchingPreviousPage={isFetchingPreviousPage}
                                rows={rows}
                                scrollViewportRef={
                                    enableVirtualization ? chatScroll.viewportRef : undefined
                                }
                                totalRows={totalRows}
                            />
                        ) : (
                            <div className="px-2 py-4 text-muted-foreground text-sm">
                                {emptyLabel}
                            </div>
                        )}
                    </div>
                </div>
                {hasTimelineContent && !chatScroll.isAtBottom ? (
                    <Button
                        aria-label="Jump to latest message"
                        className="absolute right-7 bottom-4 z-10 rounded-full bg-background/92 shadow-black/10 shadow-lg backdrop-blur"
                        onClick={() => chatScroll.scrollToBottom()}
                        size="icon"
                        type="button"
                        variant="outline"
                    >
                        <Icon className="size-4" icon={ArrowDown01Icon} />
                    </Button>
                ) : null}
            </div>

            {footer}
        </div>
    );
}
