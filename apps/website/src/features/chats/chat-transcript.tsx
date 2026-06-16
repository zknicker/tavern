import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatThinkingDisplayPreference } from '../../hooks/chats/use-chat-thinking-display-preference.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import {
    buildTranscriptRenderRows,
    transcriptRenderRowUsesActiveReply,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowView } from './chat-transcript-rows.tsx';
import { VirtualizedChatTranscript } from './virtualized-chat-transcript.tsx';

const directConversationMessageLayout: ConversationMessageLayout = {
    showAgentIdentity: false,
    showHumanIdentity: false,
};

export function ChatTranscript({
    activeReply,
    agentPresenceColor = null,
    animateMessages = true,
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
    agentPresenceColor?: string | null;
    animateMessages?: boolean;
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
    const chatThinkingDisplay = useChatThinkingDisplayPreference();
    const entries = React.useMemo(
        () =>
            buildTranscriptEntries({
                activeReply,
                failedTurn,
                rows,
                showThinkingText: chatThinkingDisplay.enabled,
            }),
        [activeReply, chatThinkingDisplay.enabled, failedTurn, rows]
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
        if (!(activeReply && activeReply.isThinking === false && activeReply.text?.trim())) {
            return;
        }

        markChatTiming('final-message-visible', {
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
                agentPresenceColor={agentPresenceColor}
                animateMessages={animateMessages}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                failedTurn={failedTurn}
                fetchPreviousPage={fetchPreviousPage}
                hasPreviousPage={hasPreviousPage}
                hiddenCount={hiddenCount}
                isFetchingPreviousPage={isFetchingPreviousPage}
                presenceRows={rows}
                rows={transcriptRows}
                scrollViewportRef={scrollViewportRef}
            />
        );
    }

    return (
        <>
            {transcriptRows.map((row) =>
                row.kind === 'hiddenCount' && hiddenCount === 0 ? null : (
                    <TranscriptRenderRowView
                        activeReply={
                            transcriptRenderRowUsesActiveReply(row, activeReply)
                                ? activeReply
                                : null
                        }
                        agentPresenceColor={agentPresenceColor}
                        animateMessages={animateMessages}
                        chatId={chatId}
                        conversationLayout={conversationLayout}
                        currentSessionKey={currentSessionKey}
                        failedTurn={failedTurn}
                        hiddenCount={hiddenCount}
                        key={row.id}
                        presenceRows={rows}
                        row={row}
                    />
                )
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
