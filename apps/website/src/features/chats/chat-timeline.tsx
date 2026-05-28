import type * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    activeReply,
    animate = false,
    chatId,
    conversationLayout,
    fetchPreviousPage,
    failedTurn,
    hasPreviousPage = false,
    isFetchingPreviousPage = false,
    rows,
    scrollViewportRef,
    totalRows,
}: {
    activeReply: ChatActiveReply | null;
    animate?: boolean;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    hasPreviousPage?: boolean;
    isFetchingPreviousPage?: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    scrollViewportRef?: React.RefObject<HTMLDivElement | null>;
    totalRows: number;
}) {
    const hiddenCount = Math.max(totalRows - rows.length, 0);

    return (
        <div className={cn('flex flex-col gap-0 py-1', animate && 'animate-float-up')}>
            <ChatTranscript
                activeReply={activeReply}
                chatId={chatId}
                conversationLayout={conversationLayout}
                failedTurn={failedTurn}
                fetchPreviousPage={fetchPreviousPage}
                hasPreviousPage={hasPreviousPage}
                hiddenCount={hiddenCount}
                isFetchingPreviousPage={isFetchingPreviousPage}
                rows={rows}
                scrollViewportRef={scrollViewportRef}
            />
        </div>
    );
}
