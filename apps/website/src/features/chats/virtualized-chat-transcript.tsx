import {
    type ReactVirtualizer,
    type Rect,
    useVirtualizer,
    type VirtualItem,
    type Virtualizer,
} from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatFollowScrollAnimation } from './chat-scroll-animation.ts';
import {
    type ChatScrollMode,
    getVirtualizerSizeAdjustmentPredicate,
    shouldAnchorVirtualizerToEnd,
} from './chat-scroll-mode.ts';
import type { ConversationMessageLayout, TranscriptRow } from './chat-transcript-model.ts';
import {
    getEstimatedTranscriptRowSize,
    getEstimatedTranscriptRowsSize,
    type TranscriptRenderRow,
    transcriptRenderRowGap,
    transcriptRenderRowUsesActiveReply,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowView } from './chat-transcript-rows.tsx';
import {
    useChatScrollControllerHandle,
    useChatScrollControllerMode,
} from './use-chat-scroll-controller.ts';

const previousPageScrollThreshold = 160;
const transcriptPinnedEndThreshold = 1;
const transcriptFallbackOverscan = 8;
const transcriptEndInset = 64;
// Smooth append scroll keeps TanStack Virtual in smooth-scroll state, where it
// skips item-size compensation. Chat tail rows grow while text and Rich
// Responses stream, so following needs exact pinned-end writes.
export const chatVirtualizerFollowOnAppendBehavior = 'auto' satisfies ScrollBehavior;

export function VirtualizedChatTranscript({
    activeReply,
    activePresenceVerb = null,
    agentPresenceColor = null,
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    failedTurn = null,
    fetchPreviousPage,
    hasPreviousPage,
    hiddenCount,
    initialScrollKey = null,
    isFetchingPreviousPage,
    presenceRows,
    rows,
    scrollViewportRef,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb?: string | null;
    agentPresenceColor?: string | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    failedTurn?: ChatTurnFailure | null;
    fetchPreviousPage?: () => void;
    hasPreviousPage: boolean;
    hiddenCount: number;
    initialScrollKey?: string | null;
    isFetchingPreviousPage: boolean;
    presenceRows: TranscriptRow[];
    rows: TranscriptRenderRow[];
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const initialScrollKeyRef = React.useRef<string | null>(null);
    const initialScrollMeasureKeyRef = React.useRef<string | null>(null);
    const initialScrollPendingRef = React.useRef(false);
    const chatScrollController = useChatScrollControllerHandle();
    const chatScrollMode = useChatScrollControllerMode();
    const chatScrollModeRef = React.useRef(chatScrollMode);
    const endReconcileFrameRef = React.useRef<number | null>(null);
    const virtualizerAnchorsToEnd = shouldAnchorVirtualizerToEnd(chatScrollMode);
    const virtualizerSizeAdjustmentPredicate =
        getVirtualizerSizeAdjustmentPredicate(chatScrollMode);
    chatScrollModeRef.current = chatScrollMode;
    const getLatestChatScrollMode = React.useCallback(
        () => chatScrollController?.getMode() ?? chatScrollModeRef.current,
        [chatScrollController]
    );
    const followScrollAnimation = useChatFollowScrollAnimation({
        getMode: getLatestChatScrollMode,
        isInitialScrollPending: () => initialScrollPendingRef.current,
    });
    const scheduleVirtualizerEndReconcile = React.useCallback(
        (instance: Virtualizer<HTMLDivElement, HTMLDivElement>) => {
            if (endReconcileFrameRef.current !== null) {
                return;
            }

            endReconcileFrameRef.current = window.requestAnimationFrame(() => {
                endReconcileFrameRef.current = null;

                if (
                    shouldReconcileVirtualizedTranscriptEnd({
                        distanceFromEnd: instance.getDistanceFromEnd(),
                        mode: getLatestChatScrollMode(),
                    })
                ) {
                    instance.scrollToEnd({ behavior: 'auto' });
                }
            });
        },
        [getLatestChatScrollMode]
    );
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        anchorTo: virtualizerAnchorsToEnd ? 'end' : 'start',
        count: rows.length,
        directDomUpdates: true,
        directDomUpdatesMode: 'transform',
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        followOnAppend: chatVirtualizerFollowOnAppendBehavior,
        gap: transcriptRenderRowGap,
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        initialRect: getInitialTranscriptViewportRect(scrollViewportRef.current),
        initialOffset: () =>
            getEstimatedTranscriptBottomOffset(
                rows,
                getInitialTranscriptViewportHeight(scrollViewportRef.current),
                transcriptEndInset
            ),
        onChange: (instance) => {
            scheduleVirtualizerEndReconcile(instance);
        },
        overscan: 8,
        paddingEnd: transcriptEndInset,
        scrollEndThreshold: transcriptPinnedEndThreshold,
        scrollToFn: (offset, { adjustments = 0, behavior }, instance) => {
            const scrollElement = instance.scrollElement;

            if (!scrollElement) {
                return;
            }

            const resolvedBehavior = getChatVirtualizerScrollBehavior({
                requestedBehavior: behavior,
            });
            const nextOffset = offset + adjustments;

            followScrollAnimation.scrollTo({
                axis: instance.options.horizontal ? 'left' : 'top',
                behavior: resolvedBehavior,
                element: scrollElement,
                target: nextOffset,
            });
        },
    });
    const totalSize = virtualizer.getTotalSize();
    const initialScrollMeasureKey = `${rows.length}:${totalSize}`;
    const virtualItems = virtualizer.getVirtualItems();
    const usingEstimatedTail = virtualItems.length === 0;
    const renderableVirtualItems = usingEstimatedTail
        ? getEstimatedTranscriptTailVirtualItems(
              rows,
              getInitialTranscriptViewportHeight(scrollViewportRef.current),
              transcriptEndInset
          )
        : virtualItems;
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;

    React.useLayoutEffect(() => {
        const controlledVirtualizer = virtualizer as SizeAdjustmentControlledVirtualizer;

        controlledVirtualizer.shouldAdjustScrollPositionOnItemSizeChange =
            virtualizerSizeAdjustmentPredicate;

        return () => {
            controlledVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
        };
    }, [virtualizer, virtualizerSizeAdjustmentPredicate]);

    React.useLayoutEffect(() => {
        if (totalSize <= 0) {
            return;
        }

        if (
            shouldReconcileVirtualizedTranscriptEnd({
                distanceFromEnd: virtualizer.getDistanceFromEnd(),
                mode: chatScrollMode,
            })
        ) {
            virtualizer.scrollToEnd({ behavior: 'auto' });
        }
    }, [chatScrollMode, totalSize, virtualizer]);

    React.useEffect(() => {
        return () => {
            if (endReconcileFrameRef.current !== null) {
                window.cancelAnimationFrame(endReconcileFrameRef.current);
                endReconcileFrameRef.current = null;
            }
        };
    }, []);

    React.useLayoutEffect(() => {
        const measureChanged = initialScrollMeasureKeyRef.current !== initialScrollMeasureKey;
        initialScrollMeasureKeyRef.current = initialScrollMeasureKey;

        if (initialScrollKey && rows.length > 0) {
            const keyChanged = initialScrollKeyRef.current !== initialScrollKey;

            if (keyChanged) {
                initialScrollPendingRef.current = true;
            }

            initialScrollKeyRef.current = initialScrollKey;

            if (
                initialScrollPendingRef.current &&
                (keyChanged || measureChanged) &&
                !virtualizer.isAtEnd(transcriptPinnedEndThreshold)
            ) {
                virtualizer.scrollToEnd({ behavior: 'auto' });
                return;
            }

            if (initialScrollPendingRef.current && (keyChanged || measureChanged)) {
                initialScrollPendingRef.current = false;
            }
        }
    }, [initialScrollKey, initialScrollMeasureKey, rows.length, virtualizer]);

    React.useEffect(() => {
        if (!initialScrollKey) {
            return;
        }

        const timer = window.setTimeout(() => {
            if (initialScrollKeyRef.current === initialScrollKey) {
                initialScrollPendingRef.current = false;
            }
        }, 1200);

        return () => window.clearTimeout(timer);
    }, [initialScrollKey]);

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
        <div className="relative w-full [overflow-anchor:none]" ref={virtualizer.containerRef}>
            {renderableVirtualItems.map((virtualItem) => {
                const row = rows[virtualItem.index];

                if (!row) {
                    return null;
                }

                const rendersActiveReply = transcriptRenderRowUsesActiveReply(row, activeReply);

                return (
                    <TranscriptVirtualRow
                        key={virtualItem.key}
                        positionsWithReact={usingEstimatedTail}
                        virtualItem={virtualItem}
                        virtualizer={virtualizer}
                    >
                        <TranscriptRenderRowView
                            activePresenceVerb={
                                row.kind === 'entry' && row.showPresence ? activePresenceVerb : null
                            }
                            activeReply={rendersActiveReply ? activeReply : null}
                            agentPresenceColor={agentPresenceColor}
                            chatId={chatId}
                            conversationLayout={conversationLayout}
                            currentSessionKey={currentSessionKey}
                            defaultOpenWorkGroups={defaultOpenWorkGroups}
                            failedTurn={failedTurn}
                            hiddenCount={hiddenCount}
                            presenceRows={presenceRows}
                            row={row}
                        />
                    </TranscriptVirtualRow>
                );
            })}
        </div>
    );
}

type SizeAdjustmentControlledVirtualizer = ReactVirtualizer<HTMLDivElement, HTMLDivElement> & {
    shouldAdjustScrollPositionOnItemSizeChange?: (
        item: VirtualItem,
        delta: number,
        instance: ReactVirtualizer<HTMLDivElement, HTMLDivElement>
    ) => boolean;
};

function TranscriptVirtualRow({
    children,
    positionsWithReact,
    virtualItem,
    virtualizer,
}: {
    children: React.ReactNode;
    positionsWithReact: boolean;
    virtualItem: VirtualItem;
    virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
}) {
    return (
        <div
            className="absolute top-0 left-0 w-full [overflow-anchor:none]"
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={
                positionsWithReact
                    ? {
                          transform: `translateY(${virtualItem.start}px)`,
                      }
                    : undefined
            }
        >
            {children}
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

export function shouldReconcileVirtualizedTranscriptEnd({
    distanceFromEnd,
    mode,
}: {
    distanceFromEnd: number;
    mode: ChatScrollMode;
}) {
    return mode === 'following' && distanceFromEnd > transcriptPinnedEndThreshold;
}

export function getEstimatedTranscriptBottomOffset(
    rows: TranscriptRenderRow[],
    viewportHeight: number,
    endInset = 0
) {
    const totalEstimatedHeight = getEstimatedTranscriptRowsSize(rows) + endInset;

    return Math.max(totalEstimatedHeight - viewportHeight, 0);
}

export function getEstimatedTranscriptTailVirtualItems(
    rows: TranscriptRenderRow[],
    viewportHeight: number,
    endInset = 0
): VirtualItem[] {
    if (rows.length === 0 || viewportHeight <= 0) {
        return [];
    }

    const items = buildEstimatedTranscriptVirtualItems(rows);
    const totalEstimatedHeight = (items.at(-1)?.end ?? 0) + endInset;
    const visibleStart = Math.max(totalEstimatedHeight - viewportHeight, 0);
    const firstVisibleIndex = items.findIndex((item) => item.end >= visibleStart);
    const startIndex = Math.max(
        (firstVisibleIndex === -1 ? items.length - 1 : firstVisibleIndex) -
            transcriptFallbackOverscan,
        0
    );

    return items.slice(startIndex);
}

export function getChatVirtualizerScrollBehavior({
    requestedBehavior,
}: {
    requestedBehavior?: ScrollBehavior;
}) {
    if (requestedBehavior) {
        return requestedBehavior;
    }

    return 'auto';
}

function buildEstimatedTranscriptVirtualItems(rows: TranscriptRenderRow[]): VirtualItem[] {
    let start = 0;

    return rows.map((row, index) => {
        const size = getEstimatedTranscriptRowSize(row);
        const item = {
            end: start + size,
            index,
            key: row.id,
            lane: 0,
            size,
            start,
        };
        start = item.end;
        return item;
    });
}

function getInitialTranscriptViewportRect(viewport: HTMLElement | null): Rect {
    if (viewport) {
        return {
            height: viewport.offsetHeight,
            width: viewport.offsetWidth,
        };
    }

    if (typeof window === 'undefined') {
        return { height: 0, width: 0 };
    }

    return {
        height: window.innerHeight,
        width: window.innerWidth,
    };
}

function getInitialTranscriptViewportHeight(viewport: HTMLElement | null) {
    if (viewport) {
        return viewport.clientHeight;
    }

    return typeof window === 'undefined' ? 0 : window.innerHeight;
}
