import type { AgentCharacter } from '@tavern/api/agent-appearance';
import type * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import type { ChatTurnTimelineMarker } from './chat-turn-timeline.tsx';

export function ChatTimeline({
    activeReplies,
    agentStatusCharacter = null,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    failedTurns,
    onTurnTimelineMarkersChange,
    rows,
    scrollContentRef,
    totalMessages,
}: {
    activeReplies: readonly ChatActiveReply[];
    agentStatusCharacter?: AgentCharacter | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    failedTurns?: readonly ChatTurnFailure[];
    onTurnTimelineMarkersChange?: (markers: ChatTurnTimelineMarker[]) => void;
    rows: NonNullable<ChatLogOutput>['rows'];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    totalMessages: number;
}) {
    const hiddenCount = Math.max(totalMessages - countDurableMessageRows(rows), 0);

    return (
        <ChatTranscript
            activeReplies={activeReplies}
            agentStatusCharacter={agentStatusCharacter}
            chatId={chatId}
            conversationLayout={conversationLayout}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            failedTurns={failedTurns}
            hiddenCount={hiddenCount}
            onTurnTimelineMarkersChange={onTurnTimelineMarkersChange}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}

// Activity-backed narration rows reuse the message row kind but are not
// durable chat messages, so they stay out of the hidden-history math.
function countDurableMessageRows(rows: NonNullable<ChatLogOutput>['rows']) {
    return rows.filter((row) => row.kind === 'message' && !row.id.startsWith('act_')).length;
}
