import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Link } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type {
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import { useChatScroll } from './use-chat-scroll.ts';

export function ChatDetailFrame({
    activeReply,
    activeReplySteps = [],
    animateTimeline = true,
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
    activeReply: ChatStatusListOutput['chats'][number]['activeReply'] | null;
    activeReplySteps?: ChatTurnProgressStep[];
    animateTimeline?: boolean;
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
    const chatScroll = useChatScroll({
        enabled: !isInitialTranscriptPending && hasTimelineContent,
    });

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex shrink-0 items-center gap-3 px-6 pt-4 pb-2">
                <Breadcrumb className="min-w-0">
                    <BreadcrumbList className="flex-nowrap">
                        <BreadcrumbItem>
                            <BreadcrumbLink render={<Link to="/dashboard/chats" />}>
                                Chats
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="min-w-0">{title}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <ChatTranscriptLoadingIndicator
                    className="absolute top-5 right-7"
                    visible={isInitialTranscriptPending}
                />
            </div>

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
                                activeReplySteps={activeReplySteps}
                                animate={animateTimeline}
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
