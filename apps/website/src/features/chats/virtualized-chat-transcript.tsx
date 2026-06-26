import {
    type ReactVirtualizer,
    type Rect,
    useVirtualizer,
    type VirtualItem,
    type Virtualizer,
} from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { writeChatScrollAnchor } from './chat-scroll-anchor-memory.ts';
import { useChatFollowScrollAnimation } from './chat-scroll-animation.ts';
import {
    type ChatScrollMode,
    getVirtualizerSizeAdjustmentPredicate,
    shouldAnchorVirtualizerToEnd,
} from './chat-scroll-mode.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { useTranscriptRenderContext } from './chat-transcript-render-context.tsx';
import {
    getEstimatedTranscriptRowSize,
    getEstimatedTranscriptRowsSize,
    type TranscriptRenderRow,
    transcriptRenderRowGap,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowItem } from './chat-transcript-rows.tsx';
import {
    buildChatTurnTimelineMarkers,
    type ChatTurnTimelineMarker,
    ChatTurnTimelineRail,
} from './chat-turn-timeline.tsx';
import {
    useChatScrollControllerHandle,
    useChatScrollControllerMode,
} from './use-chat-scroll-controller.ts';
import { useVirtualizedChatAnchorRestore } from './use-virtualized-chat-anchor-restore.ts';
import { getVirtualizedChatScrollAnchorSnapshotFromRenderedRows } from './virtualized-chat-scroll-anchor.ts';

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
    failedTurn = null,
    fetchPreviousPage,
    followKey = null,
    hasPreviousPage,
    initialScrollKey = null,
    isFetchingPreviousPage,
    presenceRows,
    rows,
    scrollViewportRef,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb?: string | null;
    agentPresenceColor?: string | null;
    failedTurn?: ChatTurnFailure | null;
    fetchPreviousPage?: () => void;
    followKey?: string | null;
    hasPreviousPage: boolean;
    initialScrollKey?: string | null;
    isFetchingPreviousPage: boolean;
    presenceRows: TranscriptRow[];
    rows: TranscriptRenderRow[];
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const { chatId, hiddenCount } = useTranscriptRenderContext();
    const initialScrollPendingRef = React.useRef(false);
    const anchorRestorePendingRef = React.useRef(false);
    const chatScrollController = useChatScrollControllerHandle();
    const chatScrollMode = useChatScrollControllerMode();
    const chatScrollModeRef = React.useRef(chatScrollMode);
    const endReconcileFrameRef = React.useRef<number | null>(null);
    const userScrollIntentPendingRef = React.useRef(false);
    const scrollAnchorCaptureAllowsPendingRef = React.useRef(false);
    const scrollAnchorCaptureFrameRef = React.useRef<number | null>(null);
    const latestChatIdRef = React.useRef(chatId);
    const virtualizerAnchorsToEnd = shouldAnchorVirtualizerToEnd(chatScrollMode);
    const virtualizerSizeAdjustmentPredicate =
        getVirtualizerSizeAdjustmentPredicate(chatScrollMode);
    chatScrollModeRef.current = chatScrollMode;
    latestChatIdRef.current = chatId;
    const getLatestChatScrollMode = React.useCallback(
        () => chatScrollController?.getMode() ?? chatScrollModeRef.current,
        [chatScrollController]
    );
    const followScrollAnimation = useChatFollowScrollAnimation({
        getMode: getLatestChatScrollMode,
        isInitialScrollPending: () => initialScrollPendingRef.current,
    });
    const rememberRenderedScrollAnchor = React.useCallback(
        (options: { allowPending?: boolean } = {}) => {
            const viewport = scrollViewportRef.current;
            const atBottom = viewport
                ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
                  transcriptPinnedEndThreshold
                : false;

            if (initialScrollPendingRef.current && atBottom) {
                initialScrollPendingRef.current = false;
                return;
            }

            if (initialScrollPendingRef.current && options.allowPending) {
                initialScrollPendingRef.current = false;
            }

            if (
                !(chatId && viewport) ||
                latestChatIdRef.current !== chatId ||
                initialScrollPendingRef.current ||
                anchorRestorePendingRef.current
            ) {
                return;
            }

            const viewportTop = viewport.getBoundingClientRect().top;
            const renderedRows = Array.from(
                viewport.querySelectorAll<HTMLElement>('[data-chat-transcript-row-id]')
            ).map((rowElement) => {
                const rect = rowElement.getBoundingClientRect();

                return {
                    bottom: rect.bottom,
                    height: rect.height,
                    rowId: rowElement.getAttribute('data-chat-transcript-row-id'),
                    top: rect.top,
                };
            });
            const snapshot = getVirtualizedChatScrollAnchorSnapshotFromRenderedRows({
                isAtBottom: atBottom,
                renderedRows,
                viewportTop,
            });

            if (snapshot) {
                writeChatScrollAnchor(chatId, snapshot);
            }
        },
        [chatId, scrollViewportRef]
    );
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
    const scheduleScrollAnchorCapture = React.useCallback(
        (options: { allowPending?: boolean } = {}) => {
            if (options.allowPending) {
                scrollAnchorCaptureAllowsPendingRef.current = true;
            }

            if (scrollAnchorCaptureFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollAnchorCaptureFrameRef.current);
            }

            scrollAnchorCaptureFrameRef.current = window.requestAnimationFrame(() => {
                scrollAnchorCaptureFrameRef.current = null;
                const allowPending = scrollAnchorCaptureAllowsPendingRef.current;
                scrollAnchorCaptureAllowsPendingRef.current = false;
                rememberRenderedScrollAnchor({ allowPending });
            });
        },
        [rememberRenderedScrollAnchor]
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
            scheduleScrollAnchorCapture();
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
    const turnTimelineMarkers = React.useMemo(() => buildChatTurnTimelineMarkers(rows), [rows]);
    const virtualItems = virtualizer.getVirtualItems();
    const usingEstimatedTail = virtualItems.length === 0;
    const renderableVirtualItems = usingEstimatedTail
        ? getEstimatedTranscriptTailVirtualItems(
              rows,
              getInitialTranscriptViewportHeight(scrollViewportRef.current),
              transcriptEndInset
          )
        : virtualItems;
    const turnTimelineViewportHeight =
        virtualizer.scrollRect?.height ??
        getInitialTranscriptViewportHeight(scrollViewportRef.current);
    const turnTimelineScrollOffset =
        virtualizer.scrollOffset ??
        (usingEstimatedTail
            ? getEstimatedTranscriptBottomOffset(
                  rows,
                  turnTimelineViewportHeight,
                  transcriptEndInset
              )
            : 0);
    const activeTurnTimelineMarkerIds = getVisibleChatTurnTimelineMarkerIds({
        markers: turnTimelineMarkers,
        scrollOffset: turnTimelineScrollOffset,
        viewportHeight: turnTimelineViewportHeight,
        virtualItems: renderableVirtualItems,
    });
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;
    useVirtualizedChatAnchorRestore({
        anchorRestorePendingRef,
        chatId,
        chatScrollController,
        initialScrollKey,
        initialScrollMeasureKey,
        initialScrollPendingRef,
        pinnedEndThreshold: transcriptPinnedEndThreshold,
        rows,
        virtualItems,
        virtualizer,
    });

    React.useLayoutEffect(() => {
        if (!chatScrollController) {
            return;
        }

        return chatScrollController.registerScrollToBottomWriter((behavior) => {
            virtualizer.scrollToEnd({ behavior });
        });
    }, [chatScrollController, virtualizer]);

    React.useLayoutEffect(() => {
        if (!followKey) {
            return;
        }

        if (chatScrollController) {
            chatScrollController.scrollToBottom('auto');
            return;
        }

        virtualizer.scrollToEnd({ behavior: 'auto' });
    }, [chatScrollController, followKey, virtualizer]);

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
                mode: getLatestChatScrollMode(),
            })
        ) {
            virtualizer.scrollToEnd({ behavior: 'auto' });
        }
    }, [getLatestChatScrollMode, totalSize, virtualizer]);

    React.useEffect(() => {
        return () => {
            if (endReconcileFrameRef.current !== null) {
                window.cancelAnimationFrame(endReconcileFrameRef.current);
                endReconcileFrameRef.current = null;
            }
        };
    }, []);

    React.useEffect(() => {
        const viewport = scrollViewportRef.current;

        if (!viewport) {
            return;
        }

        const markUserScrollIntent = () => {
            userScrollIntentPendingRef.current = true;
        };
        const captureAfterScroll = () => {
            const allowPending = userScrollIntentPendingRef.current;
            userScrollIntentPendingRef.current = false;
            scheduleScrollAnchorCapture({ allowPending });
        };

        viewport.addEventListener('wheel', markUserScrollIntent, { passive: true });
        viewport.addEventListener('touchstart', markUserScrollIntent, { passive: true });
        viewport.addEventListener('scroll', captureAfterScroll, { passive: true });

        return () => {
            viewport.removeEventListener('wheel', markUserScrollIntent);
            viewport.removeEventListener('touchstart', markUserScrollIntent);
            viewport.removeEventListener('scroll', captureAfterScroll);
            userScrollIntentPendingRef.current = false;

            if (scrollAnchorCaptureFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollAnchorCaptureFrameRef.current);
                scrollAnchorCaptureFrameRef.current = null;
            }

            scrollAnchorCaptureAllowsPendingRef.current = false;
        };
    }, [scheduleScrollAnchorCapture, scrollViewportRef]);

    React.useEffect(() => {
        const captureBeforeInteraction = () => {
            rememberRenderedScrollAnchor({ allowPending: true });
        };

        document.addEventListener('pointerdown', captureBeforeInteraction, { capture: true });
        document.addEventListener('mousedown', captureBeforeInteraction, { capture: true });
        document.addEventListener('click', captureBeforeInteraction, { capture: true });
        window.addEventListener('pagehide', captureBeforeInteraction);

        return () => {
            document.removeEventListener('pointerdown', captureBeforeInteraction, {
                capture: true,
            });
            document.removeEventListener('mousedown', captureBeforeInteraction, {
                capture: true,
            });
            document.removeEventListener('click', captureBeforeInteraction, {
                capture: true,
            });
            window.removeEventListener('pagehide', captureBeforeInteraction);
        };
    }, [rememberRenderedScrollAnchor]);

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
            <ChatTurnTimelineRail
                activeMarkerIds={activeTurnTimelineMarkerIds}
                markers={turnTimelineMarkers}
                onSelect={(marker: ChatTurnTimelineMarker) => {
                    chatScrollController?.beginHistoryNavigation();
                    virtualizer.scrollToIndex(marker.rowIndex, {
                        align: 'center',
                        behavior: 'smooth',
                    });
                }}
            />
            {renderableVirtualItems.map((virtualItem) => {
                const row = rows[virtualItem.index];

                if (!row) {
                    return null;
                }

                return (
                    <TranscriptVirtualRow
                        key={virtualItem.key}
                        positionsWithReact={usingEstimatedTail}
                        rowId={row.id}
                        virtualItem={virtualItem}
                        virtualizer={virtualizer}
                    >
                        <TranscriptRenderRowItem
                            activePresenceVerb={activePresenceVerb}
                            activeReply={activeReply}
                            agentPresenceColor={agentPresenceColor}
                            failedTurn={failedTurn}
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
    rowId,
    virtualItem,
    virtualizer,
}: {
    children: React.ReactNode;
    positionsWithReact: boolean;
    rowId: string;
    virtualItem: VirtualItem;
    virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
}) {
    return (
        <div
            className="absolute top-0 left-0 w-full [overflow-anchor:none]"
            data-chat-transcript-row-id={rowId}
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

export function getVisibleChatTurnTimelineMarkerIds({
    markers,
    scrollOffset,
    viewportHeight,
    virtualItems,
}: {
    markers: ChatTurnTimelineMarker[];
    scrollOffset: number;
    viewportHeight: number;
    virtualItems: VirtualItem[];
}) {
    const visibleMarkerIds = new Set<string>();

    if (markers.length === 0 || virtualItems.length === 0 || viewportHeight <= 0) {
        return visibleMarkerIds;
    }

    const viewportStart = scrollOffset;
    const viewportEnd = scrollOffset + viewportHeight;
    const visibleRowIndices = new Set<number>();

    for (const item of virtualItems) {
        if (item.end <= viewportStart || item.start >= viewportEnd) {
            continue;
        }

        visibleRowIndices.add(item.index);
    }

    for (const marker of markers) {
        if (visibleRowIndices.has(marker.rowIndex) || visibleRowIndices.has(marker.agentRowIndex)) {
            visibleMarkerIds.add(marker.id);
        }
    }

    return visibleMarkerIds;
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
