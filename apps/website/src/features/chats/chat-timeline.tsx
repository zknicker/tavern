import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    activeReply,
    agentPresenceColor = null,
    animate = false,
    chatId,
    conversationLayout,
    fetchPreviousPage,
    failedTurn,
    hasPreviousPage = false,
    isFetchingPreviousPage = false,
    rows,
    scrollViewportRef,
    totalMessages,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    animate?: boolean;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    hasPreviousPage?: boolean;
    isFetchingPreviousPage?: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    scrollViewportRef?: React.RefObject<HTMLDivElement | null>;
    totalMessages: number;
}) {
    const hiddenCount = Math.max(totalMessages - countDurableMessageRows(rows), 0);
    const [messageEntrancesEnabled, setMessageEntrancesEnabled] = React.useState(animate);

    React.useEffect(() => {
        if (messageEntrancesEnabled) {
            return;
        }

        const frame = requestAnimationFrame(() => setMessageEntrancesEnabled(true));
        return () => cancelAnimationFrame(frame);
    }, [messageEntrancesEnabled]);

    return (
        <div className={cn('flex flex-col gap-0 py-1', animate && 'animate-float-up')}>
            <ChatTranscript
                activeReply={activeReply}
                agentPresenceColor={agentPresenceColor}
                animateMessages={messageEntrancesEnabled}
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

// Activity-backed narration rows reuse the message row kind but are not
// durable chat messages, so they stay out of the hidden-history math.
function countDurableMessageRows(rows: NonNullable<ChatLogOutput>['rows']) {
    return rows.filter((row) => row.kind === 'message' && !row.id.startsWith('act_')).length;
}
