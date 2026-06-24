import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatThinkingDisplayPreference } from '../../hooks/chats/use-chat-thinking-display-preference.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { resolveActivePresenceVerb } from './chat-active-presence-verb.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import {
    buildTranscriptRenderRows,
    computeStableTranscriptRenderRows,
    type StableTranscriptRenderRowsState,
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
    chatId,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    fetchPreviousPage,
    failedTurn = null,
    hasPreviousPage = false,
    followKey = null,
    hiddenCount = 0,
    initialScrollKey = null,
    isFetchingPreviousPage = false,
    rows,
    scrollViewportRef,
    showThinkingText,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    fetchPreviousPage?: () => void;
    failedTurn?: ChatTurnFailure | null;
    hasPreviousPage?: boolean;
    followKey?: string | null;
    hiddenCount?: number;
    initialScrollKey?: string | null;
    isFetchingPreviousPage?: boolean;
    rows: TranscriptRow[];
    scrollViewportRef?: React.RefObject<HTMLDivElement | null>;
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
    const latestAgentMessage = React.useMemo(() => getLatestAgentMessage(rows), [rows]);
    const activePresenceVerb = useActivePresenceVerb(activeReply);

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
                activePresenceVerb={activePresenceVerb}
                activeReply={activeReply}
                agentPresenceColor={agentPresenceColor}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                defaultOpenWorkGroups={defaultOpenWorkGroups}
                failedTurn={failedTurn}
                fetchPreviousPage={fetchPreviousPage}
                followKey={followKey}
                hasPreviousPage={hasPreviousPage}
                hiddenCount={hiddenCount}
                initialScrollKey={initialScrollKey}
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
                        activePresenceVerb={
                            row.kind === 'entry' && row.showPresence ? activePresenceVerb : null
                        }
                        activeReply={
                            transcriptRenderRowUsesActiveReply(row, activeReply)
                                ? activeReply
                                : null
                        }
                        agentPresenceColor={agentPresenceColor}
                        chatId={chatId}
                        conversationLayout={conversationLayout}
                        currentSessionKey={currentSessionKey}
                        defaultOpenWorkGroups={defaultOpenWorkGroups}
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

function useActivePresenceVerb(activeReply: ChatActiveReply | null) {
    const verbRef = React.useRef<string | null>(null);
    const verb = resolveActivePresenceVerb({
        activeReply,
        currentVerb: verbRef.current,
    });

    verbRef.current = verb;

    return verb;
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
