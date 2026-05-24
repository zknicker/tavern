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
    error,
    failedTurn,
    footer,
    historyLoaded,
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
    error?: unknown;
    failedTurn?: ChatTurnFailure | null;
    footer: React.ReactNode;
    historyLoaded: boolean;
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
    const activeReplyText = activeReply?.text?.trim() ?? '';
    const chatScroll = useChatScroll({
        enabled: !isInitialTranscriptPending && hasTimelineContent,
        followResizes: !(activeReply && activeReplyText.length === 0),
        followKey,
    });

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
                    className="h-full min-h-0 overflow-y-auto px-6 py-5"
                    onScroll={chatScroll.handleScroll}
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
                                rows={rows}
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
