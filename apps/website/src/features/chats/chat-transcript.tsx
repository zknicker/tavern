import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/ui/message-scroller.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatThinkingDisplayPreference } from '../../hooks/chats/use-chat-thinking-display-preference.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import {
    type TranscriptRenderContextValue,
    TranscriptRenderProvider,
} from './chat-transcript-render-context.tsx';
import {
    buildTranscriptRenderRows,
    computeStableTranscriptRenderRows,
    type StableTranscriptRenderRowsState,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowItem } from './chat-transcript-rows.tsx';
import {
    buildChatTurnTimelineMarkers,
    type ChatTurnTimelineMarker,
} from './chat-turn-timeline.tsx';

const directConversationMessageLayout: ConversationMessageLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
};

export function ChatTranscript({
    activeReply,
    agentStatusCharacter = null,
    chatId,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    failedTurn = null,
    hiddenCount = 0,
    rows,
    onTurnTimelineMarkersChange,
    scrollContentRef,
    showThinkingText,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusCharacter?: AgentCharacter | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    failedTurn?: ChatTurnFailure | null;
    hiddenCount?: number;
    onTurnTimelineMarkersChange?: (markers: ChatTurnTimelineMarker[]) => void;
    rows: TranscriptRow[];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    showThinkingText?: boolean;
}) {
    const chatThinkingDisplay = useChatThinkingDisplayPreference();
    const thinkingTextVisible = showThinkingText ?? chatThinkingDisplay.enabled;
    const entries = React.useMemo(
        () =>
            buildTranscriptEntries({
                activeReply,
                failedTurn,
                rows,
                showThinkingText: thinkingTextVisible,
            }),
        [activeReply, failedTurn, rows, thinkingTextVisible]
    );
    const rawTranscriptRows = React.useMemo(
        () => buildTranscriptRenderRows(entries, hiddenCount),
        [entries, hiddenCount]
    );
    const transcriptRows = useStableTranscriptRenderRows(rawTranscriptRows);
    const turnTimelineMarkers = React.useMemo(
        () => buildChatTurnTimelineMarkers(transcriptRows),
        [transcriptRows]
    );
    const latestAgentMessage = React.useMemo(() => getLatestAgentMessage(rows), [rows]);
    const renderContext = React.useMemo(
        () =>
            ({
                chatId,
                conversationLayout,
                currentSessionKey,
                defaultOpenWorkGroups,
                hiddenCount,
            }) satisfies TranscriptRenderContextValue,
        [chatId, conversationLayout, currentSessionKey, defaultOpenWorkGroups, hiddenCount]
    );

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

    React.useEffect(() => {
        onTurnTimelineMarkersChange?.(turnTimelineMarkers);
    }, [onTurnTimelineMarkersChange, turnTimelineMarkers]);

    const transcript = (
        <TranscriptRenderProvider value={renderContext}>
            <div className="relative mx-auto min-h-full w-full max-w-[60rem]">
                <MessageScrollerContent className="w-full gap-1.5" ref={scrollContentRef}>
                    {transcriptRows.map((row) =>
                        row.kind === 'hiddenCount' && hiddenCount === 0 ? null : (
                            <MessageScrollerItem
                                // Drop paint containment so a message's hover
                                // action island can sit on top of the row
                                // without being clipped, keeping rows tight.
                                className="![content-visibility:visible]"
                                key={row.id}
                                messageId={row.id}
                                scrollAnchor={isTranscriptRenderRowScrollAnchor(row)}
                            >
                                <TranscriptRenderRowItem
                                    activeReply={activeReply}
                                    agentStatusCharacter={agentStatusCharacter}
                                    row={row}
                                />
                            </MessageScrollerItem>
                        )
                    )}
                </MessageScrollerContent>
            </div>
        </TranscriptRenderProvider>
    );

    if (!scrollContentRef) {
        return (
            <MessageScrollerProvider defaultScrollPosition="end" scrollPreviousItemPeek={64}>
                <MessageScroller>
                    <MessageScrollerViewport>{transcript}</MessageScrollerViewport>
                </MessageScroller>
            </MessageScrollerProvider>
        );
    }

    return transcript;
}

function isTranscriptRenderRowScrollAnchor(
    row: ReturnType<typeof buildTranscriptRenderRows>[number]
) {
    return row.kind === 'entry' && row.entry.kind === 'turn' && row.entry.participant === 'user';
}

function useStableTranscriptRenderRows(rows: ReturnType<typeof buildTranscriptRenderRows>) {
    const stateRef = React.useRef<StableTranscriptRenderRowsState>({
        byId: new Map(),
        result: [],
    });

    return React.useMemo(() => {
        const nextState = computeStableTranscriptRenderRows(rows, stateRef.current);
        stateRef.current = nextState;
        return nextState.result;
    }, [rows]);
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
