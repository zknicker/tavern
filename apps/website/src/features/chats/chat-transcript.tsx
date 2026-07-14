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
import { markChatTiming } from '../../lib/chat-timing.ts';
import { getTranscriptItemKey } from './chat-transcript-item-utils.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    getRepliedRunIds,
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
    activeReplies,
    agentStatusCharacter = null,
    chatId,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    failedTurns = [],
    hiddenCount = 0,
    rows,
    onTurnTimelineMarkersChange,
    scrollContentRef,
}: {
    activeReplies: readonly ChatActiveReply[];
    agentStatusCharacter?: AgentCharacter | null;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    failedTurns?: readonly ChatTurnFailure[];
    hiddenCount?: number;
    onTurnTimelineMarkersChange?: (markers: ChatTurnTimelineMarker[]) => void;
    rows: TranscriptRow[];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const entries = React.useMemo(
        () =>
            buildTranscriptEntries({
                activeReplies,
                failedTurns,
                rows,
            }),
        [activeReplies, failedTurns, rows]
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
    // Sticky across renders: the completion handoff can clear the live reply
    // a beat before the durable reply row lands, and narration must not flash
    // back into the pane during that gap.
    const seenRepliedRunsRef = React.useRef(new Set<string>());
    const repliedRunIds = React.useMemo(() => {
        for (const runId of getRepliedRunIds(rows, activeReplies)) {
            seenRepliedRunsRef.current.add(runId);
        }

        return new Set(seenRepliedRunsRef.current);
    }, [rows, activeReplies]);
    const shouldAnimateItemEnter = useLiveEdgeItemEnter(chatId, transcriptRows);
    const renderContext = React.useMemo(
        () =>
            ({
                chatId,
                conversationLayout,
                currentSessionKey,
                defaultOpenWorkGroups,
                hiddenCount,
                repliedRunIds,
                shouldAnimateItemEnter,
            }) satisfies TranscriptRenderContextValue,
        [
            chatId,
            conversationLayout,
            currentSessionKey,
            defaultOpenWorkGroups,
            hiddenCount,
            repliedRunIds,
            shouldAnimateItemEnter,
        ]
    );

    React.useEffect(() => {
        for (const reply of activeReplies) {
            markChatTiming('thinking-visible', {
                runId: reply.runId,
                sessionKey: reply.sessionKey,
            });
        }
    }, [activeReplies]);

    React.useEffect(() => {
        for (const reply of activeReplies) {
            if (reply.isThinking === false && reply.text?.trim()) {
                markChatTiming('final-message-visible', {
                    runId: reply.runId,
                    sessionKey: reply.sessionKey,
                });
            }
        }
    }, [activeReplies]);

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
                            >
                                <TranscriptRenderRowItem
                                    activeReplies={activeReplies}
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
            <MessageScrollerProvider defaultScrollPosition="end">
                <MessageScroller>
                    <MessageScrollerViewport>{transcript}</MessageScrollerViewport>
                </MessageScroller>
            </MessageScrollerProvider>
        );
    }

    return transcript;
}

// Pagination timestamps are minutes-to-months old; live rows land within
// moments of the client clock. The slack absorbs modest clock skew between
// the client and a remote runtime host.
const liveEdgeEnterSlackMs = 60 * 1000;

// Items present at first render (or restored when switching back to a chat)
// must not animate; only items that mount afterwards with a live timestamp
// read as arrivals. Keyed per chat so a chat switch re-seeds the baseline.
function useLiveEdgeItemEnter(
    chatId: string | undefined,
    transcriptRows: ReturnType<typeof buildTranscriptRenderRows>
) {
    const stateRef = React.useRef<{
        chatId: string | undefined;
        mountedAtMs: number;
        ready: boolean;
        seen: Set<string>;
    }>({ chatId, mountedAtMs: Date.now(), ready: false, seen: new Set() });

    if (stateRef.current.chatId !== chatId) {
        stateRef.current = {
            chatId,
            mountedAtMs: Date.now(),
            ready: false,
            seen: new Set(),
        };
    }

    React.useEffect(() => {
        const state = stateRef.current;

        for (const row of transcriptRows) {
            if (row.kind !== 'entry' || row.entry.kind === 'system') {
                continue;
            }

            for (const item of row.entry.items) {
                state.seen.add(getTranscriptItemKey(item));
            }
        }

        state.ready = true;
    }, [transcriptRows]);

    return React.useCallback((key: string, timestampMs: number | null) => {
        const state = stateRef.current;

        return (
            state.ready &&
            !state.seen.has(key) &&
            (timestampMs === null || timestampMs >= state.mountedAtMs - liveEdgeEnterSlackMs)
        );
    }, []);
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
