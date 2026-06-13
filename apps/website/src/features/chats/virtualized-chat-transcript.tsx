import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import {
    type ConversationMessageLayout,
    type TranscriptRow,
    transcriptEntryUsesActiveReply,
} from './chat-transcript-model.ts';
import {
    getEstimatedTranscriptRowSize,
    type TranscriptRenderRow,
} from './chat-transcript-row-model.ts';
import { TranscriptEntryRow } from './chat-transcript-rows.tsx';
import { useChatScrollControllerHandle } from './use-chat-scroll-controller.ts';

const previousPageScrollThreshold = 160;

export function VirtualizedChatTranscript({
    activeReply,
    agentPresenceColor = null,
    chatId,
    conversationLayout,
    currentSessionKey,
    failedTurn = null,
    fetchPreviousPage,
    hasPreviousPage,
    hiddenCount,
    isFetchingPreviousPage,
    presenceRows,
    rows,
    scrollViewportRef,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    failedTurn?: ChatTurnFailure | null;
    fetchPreviousPage?: () => void;
    hasPreviousPage: boolean;
    hiddenCount: number;
    isFetchingPreviousPage: boolean;
    presenceRows: TranscriptRow[];
    rows: TranscriptRenderRow[];
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const scrollController = useChatScrollControllerHandle();
    const virtualizer = useVirtualizer({
        count: rows.length,
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        initialOffset: () =>
            getEstimatedTranscriptBottomOffset(
                rows,
                getInitialTranscriptViewportHeight(scrollViewportRef.current)
            ),
        overscan: 8,
    });
    // The scroll controller decides when item-resize compensation is safe:
    // only while the user reads scrolled-up history. While following or
    // anchored, the controller owns the position and compensating as well
    // makes the two fight during animated collapses.
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item) =>
        scrollController ? scrollController.shouldVirtualizerAdjust(item.start) : false;
    const virtualItems = virtualizer.getVirtualItems();
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;

    React.useEffect(() => {
        const viewport = scrollViewportRef.current;

        if (!(viewport && fetchPreviousPage)) {
            return;
        }

        if (
            !shouldLoadPreviousVirtualizedChatPage({
                firstEntryIndex,
                hasHiddenCount: hiddenCount > 0,
                hasPreviousPage,
                isFetchingPreviousPage,
                scrollTop: viewport.scrollTop,
            })
        ) {
            return;
        }

        fetchPreviousPage();
    }, [
        fetchPreviousPage,
        firstEntryIndex,
        hasPreviousPage,
        hiddenCount,
        isFetchingPreviousPage,
        scrollViewportRef,
    ]);

    return (
        <div
            className="relative w-full [overflow-anchor:none]"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
            {virtualItems.map((virtualItem) => {
                const row = rows[virtualItem.index];

                if (!row) {
                    return null;
                }

                return (
                    <div
                        className="absolute top-0 left-0 w-full [overflow-anchor:none]"
                        data-index={virtualItem.index}
                        key={virtualItem.key}
                        ref={virtualizer.measureElement}
                        style={{
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {row.kind === 'hiddenCount' ? (
                            <SessionLogHiddenCount hiddenCount={hiddenCount} />
                        ) : (
                            <TranscriptEntryRow
                                activeReply={
                                    transcriptEntryUsesActiveReply(row.entry, activeReply)
                                        ? activeReply
                                        : null
                                }
                                agentPresenceColor={agentPresenceColor}
                                chatId={chatId}
                                conversationLayout={conversationLayout}
                                currentSessionKey={currentSessionKey}
                                failedTurn={failedTurn}
                                presenceRows={presenceRows}
                                row={row}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function shouldLoadPreviousVirtualizedChatPage({
    firstEntryIndex,
    hasHiddenCount,
    hasPreviousPage,
    isFetchingPreviousPage,
    scrollTop,
}: {
    firstEntryIndex?: number;
    hasHiddenCount: boolean;
    hasPreviousPage: boolean;
    isFetchingPreviousPage: boolean;
    scrollTop: number;
}) {
    if (
        firstEntryIndex === undefined ||
        firstEntryIndex > (hasHiddenCount ? 3 : 2) ||
        scrollTop > previousPageScrollThreshold ||
        !hasPreviousPage ||
        isFetchingPreviousPage
    ) {
        return false;
    }

    return true;
}

export function getEstimatedTranscriptBottomOffset(
    rows: TranscriptRenderRow[],
    viewportHeight: number
) {
    const totalEstimatedHeight = rows.reduce(
        (total, row) => total + getEstimatedTranscriptRowSize(row),
        0
    );

    return Math.max(totalEstimatedHeight - viewportHeight, 0);
}

function getInitialTranscriptViewportHeight(viewport: HTMLElement | null) {
    if (viewport) {
        return viewport.clientHeight;
    }

    return typeof window === 'undefined' ? 0 : window.innerHeight;
}
