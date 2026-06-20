import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    activeReply,
    agentPresenceColor = null,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    fetchPreviousPage,
    failedTurn,
    hasPreviousPage = false,
    initialScrollKey = null,
    isFetchingPreviousPage = false,
    rows,
    scrollViewportRef,
    showThinkingText,
    totalMessages,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    hasPreviousPage?: boolean;
    initialScrollKey?: string | null;
    isFetchingPreviousPage?: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    scrollViewportRef?: React.RefObject<HTMLDivElement | null>;
    showThinkingText?: boolean;
    totalMessages: number;
}) {
    const hiddenCount = Math.max(totalMessages - countDurableMessageRows(rows), 0);

    return (
        <div className="flex flex-col gap-3 py-1">
            <ChatTranscript
                activeReply={activeReply}
                agentPresenceColor={agentPresenceColor}
                chatId={chatId}
                conversationLayout={conversationLayout}
                defaultOpenWorkGroups={defaultOpenWorkGroups}
                failedTurn={failedTurn}
                fetchPreviousPage={fetchPreviousPage}
                hasPreviousPage={hasPreviousPage}
                hiddenCount={hiddenCount}
                initialScrollKey={initialScrollKey}
                isFetchingPreviousPage={isFetchingPreviousPage}
                rows={rows}
                scrollViewportRef={scrollViewportRef}
                showThinkingText={showThinkingText}
            />
        </div>
    );
}

// Activity-backed narration rows reuse the message row kind but are not
// durable chat messages, so they stay out of the hidden-history math.
function countDurableMessageRows(rows: NonNullable<ChatLogOutput>['rows']) {
    return rows.filter((row) => row.kind === 'message' && !row.id.startsWith('act_')).length;
}
