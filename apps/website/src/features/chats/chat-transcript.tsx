import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import { buildTranscriptRenderRows } from './chat-transcript-row-model.ts';
import { TranscriptEntryRow } from './chat-transcript-rows.tsx';
import { VirtualizedChatTranscript } from './virtualized-chat-transcript.tsx';

const directConversationMessageLayout: ConversationMessageLayout = {
    showAgentIdentity: false,
    showHumanIdentity: false,
};

export function ChatTranscript({
    activeReply,
    chatId,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    fetchPreviousPage,
    failedTurn = null,
    hasPreviousPage = false,
    hiddenCount = 0,
    isFetchingPreviousPage = false,
    rows,
    scrollViewportRef,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    hasPreviousPage?: boolean;
    hiddenCount?: number;
    isFetchingPreviousPage?: boolean;
    rows: TranscriptRow[];
    scrollViewportRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const entries = React.useMemo(
        () =>
            buildTranscriptEntries({
                activeReply,
                failedTurn,
                rows,
            }),
        [activeReply, failedTurn, rows]
    );
    const transcriptRows = React.useMemo(
        () => buildTranscriptRenderRows(entries, hiddenCount),
        [entries, hiddenCount]
    );
    const latestAgentMessage = React.useMemo(() => getLatestAgentMessage(rows), [rows]);

    React.useEffect(() => {
        if (!activeReply) {
            return;
        }

        markChatTiming('thinking-visible', {
            runId: activeReply.runId,
            sessionKey: activeReply.sessionKey,
        });
    }, [activeReply]);

    React.useEffect(() => {
        if (!latestAgentMessage) {
            return;
        }

        markChatTiming('final-message-visible', {
            messageId: latestAgentMessage.id,
            sessionKey: latestAgentMessage.sourceSessionKey,
        });
    }, [latestAgentMessage]);

    if (scrollViewportRef) {
        return (
            <VirtualizedChatTranscript
                activeReply={activeReply}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                fetchPreviousPage={fetchPreviousPage}
                hasPreviousPage={hasPreviousPage}
                hiddenCount={hiddenCount}
                isFetchingPreviousPage={isFetchingPreviousPage}
                rows={transcriptRows}
                scrollViewportRef={scrollViewportRef}
            />
        );
    }

    return (
        <>
            <SessionLogHiddenCount hiddenCount={hiddenCount} />
            {transcriptRows.map((row) =>
                row.kind === 'entry' ? (
                    <TranscriptEntryRow
                        activeReply={activeReply}
                        chatId={chatId}
                        conversationLayout={conversationLayout}
                        currentSessionKey={currentSessionKey}
                        key={row.id}
                        row={row}
                    />
                ) : null
            )}
        </>
    );
}

function getLatestAgentMessage(rows: TranscriptRow[]) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row?.kind === 'message' && row.message.senderType === 'agent') {
            return row.message;
        }
    }

    return null;
}
