import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
    useMessageScroller,
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
    const lastUserTurnAnchor = React.useMemo(() => {
        for (let index = transcriptRows.length - 1; index >= 0; index -= 1) {
            const row = transcriptRows[index];

            if (row && isTranscriptRenderRowScrollAnchor(row) && row.kind === 'entry') {
                const lastItem = row.entry.kind === 'turn' ? row.entry.items.at(-1) : null;

                return {
                    // Consecutive sends group into one turn entry, so the
                    // change signal must include the newest item, not just
                    // the entry id.
                    changeKey: `${row.id}:${lastItem ? getTranscriptItemKey(lastItem) : ''}`,
                    rowId: row.id,
                };
            }
        }

        return null;
    }, [transcriptRows]);
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
    const renderContext = React.useMemo(
        () =>
            ({
                chatId,
                conversationLayout,
                currentSessionKey,
                defaultOpenWorkGroups,
                hiddenCount,
                repliedRunIds,
            }) satisfies TranscriptRenderContextValue,
        [
            chatId,
            conversationLayout,
            currentSessionKey,
            defaultOpenWorkGroups,
            hiddenCount,
            repliedRunIds,
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
                                scrollAnchor={isTranscriptRenderRowScrollAnchor(row)}
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
                <UserTurnAnchorEffect anchor={lastUserTurnAnchor} chatId={chatId} />
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

// Anchors a freshly sent user message to the top of the viewport (spacer
// below, Claude-style). The scroller primitive only does this on its own when
// the item count grows; in windowed chats a new message trims older rows at
// the same time, so the count stays flat and the anchor must be explicit.
function UserTurnAnchorEffect({
    anchor,
    chatId,
}: {
    anchor: { changeKey: string; rowId: string } | null;
    chatId?: string;
}) {
    const { scrollToMessage } = useMessageScroller();
    const changeKey = anchor?.changeKey ?? null;
    const rowId = anchor?.rowId ?? null;
    const stateRef = React.useRef({ changeKey, chatId });
    // Latest-callback ref: the scroller context rebuilds its callbacks across
    // renders, and a callback dep would re-run this effect (cancelling the
    // scheduled frame) before it fires.
    const scrollToMessageRef = React.useRef(scrollToMessage);
    scrollToMessageRef.current = scrollToMessage;

    React.useEffect(() => {
        const previous = stateRef.current;
        stateRef.current = { changeKey, chatId };

        // Never anchor on mount or when switching chats — only when a new
        // user message lands in the same chat.
        if (
            !(changeKey && rowId) ||
            previous.chatId !== chatId ||
            previous.changeKey === changeKey
        ) {
            return;
        }

        // Synchronous on purpose: requestAnimationFrame never fires in
        // hidden windows, and the target item is already mounted when the
        // effect runs. The anchor glides — an instant jump reads as a broken
        // frame — except for hidden windows (smooth never settles there) and
        // reduced-motion readers.
        const instant =
            document.visibilityState === 'hidden' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        scrollToMessageRef.current(rowId, {
            align: 'start',
            behavior: instant ? 'auto' : 'smooth',
        });
    }, [changeKey, chatId, rowId]);

    return null;
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
