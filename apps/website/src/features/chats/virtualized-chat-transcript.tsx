import {
    type ReactVirtualizer,
    type Rect,
    useVirtualizer,
    type VirtualItem,
} from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import {
    shouldAdjustVirtualizerOnItemSizeChange,
    shouldAnchorVirtualizerToEnd,
} from './chat-scroll-mode.ts';
import { getTranscriptItemKey } from './chat-transcript-item-utils.ts';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptRow,
} from './chat-transcript-model.ts';
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
const transcriptScrollEndThreshold = 72;
const transcriptPinnedEndThreshold = 1;
const transcriptFallbackOverscan = 8;
const transcriptEndInset = 64;

export function VirtualizedChatTranscript({
    activeReply,
    activePresenceVerb = null,
    agentPresenceColor = null,
    animateMessages,
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
    animateMessages: boolean;
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
    const previousRowGrowthSnapshotRef = React.useRef<TranscriptRowGrowthSnapshot | null>(null);
    const chatScrollController = useChatScrollControllerHandle();
    const chatScrollMode = useChatScrollControllerMode();
    const virtualizerAnchorsToEnd = shouldAnchorVirtualizerToEnd(chatScrollMode);
    const virtualizerAdjustsItemSize = shouldAdjustVirtualizerOnItemSizeChange(chatScrollMode);
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        anchorTo: virtualizerAnchorsToEnd ? 'end' : 'start',
        count: rows.length,
        directDomUpdates: true,
        directDomUpdatesMode: 'transform',
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        followOnAppend: 'smooth',
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
        onChange: (instance, sync) => {
            if (
                sync ||
                initialScrollPendingRef.current ||
                !shouldCorrectVirtualizedTranscriptEndGap({
                    distanceFromEnd: instance.getDistanceFromEnd(),
                    isFollowing: chatScrollController?.getMode() === 'following',
                })
            ) {
                return;
            }

            instance.scrollToEnd({ behavior: 'auto' });
        },
        overscan: 8,
        paddingEnd: transcriptEndInset,
        scrollEndThreshold: transcriptScrollEndThreshold,
        scrollToFn: (offset, { adjustments = 0, behavior }, instance) => {
            const scrollElement = instance.scrollElement;

            if (!scrollElement) {
                return;
            }

            const resolvedBehavior = getChatVirtualizerScrollBehavior({
                hasAdjustments: adjustments !== 0,
                isFollowing: chatScrollController?.getMode() === 'following',
                requestedBehavior: behavior,
            });
            const nextOffset = offset + adjustments;

            if (instance.options.horizontal) {
                scrollElement.scrollTo({ behavior: resolvedBehavior, left: nextOffset });
                return;
            }

            scrollElement.scrollTo({ behavior: resolvedBehavior, top: nextOffset });
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

        controlledVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = () =>
            virtualizerAdjustsItemSize;

        return () => {
            controlledVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
        };
    }, [virtualizer, virtualizerAdjustsItemSize]);

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

    React.useLayoutEffect(() => {
        const previous = previousRowGrowthSnapshotRef.current;
        const next = getTranscriptRowGrowthSnapshot(rows);

        previousRowGrowthSnapshotRef.current = next;

        if (
            !shouldFollowTailGrowth({
                isFollowing: chatScrollMode === 'following',
                next,
                previous,
            }) ||
            initialScrollPendingRef.current
        ) {
            return;
        }

        virtualizer.scrollToEnd({ behavior: 'auto' });
    }, [chatScrollMode, rows, virtualizer]);

    React.useLayoutEffect(() => {
        if (
            initialScrollPendingRef.current ||
            !shouldCorrectVirtualizedTranscriptEndGap({
                distanceFromEnd: virtualizer.getDistanceFromEnd(),
                isFollowing: chatScrollMode === 'following',
            })
        ) {
            return;
        }

        virtualizer.scrollToEnd({ behavior: 'auto' });
    });

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
                            activePresenceVerb={row.kind === 'presence' ? activePresenceVerb : null}
                            activeReply={rendersActiveReply ? activeReply : null}
                            agentPresenceColor={agentPresenceColor}
                            animateMessages={animateMessages}
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
    hasAdjustments: boolean;
    isFollowing: boolean;
    requestedBehavior?: ScrollBehavior;
}) {
    if (requestedBehavior) {
        return requestedBehavior;
    }

    return 'auto';
}

export function shouldCorrectVirtualizedTranscriptEndGap({
    distanceFromEnd,
    isFollowing,
}: {
    distanceFromEnd: number;
    isFollowing: boolean;
}) {
    return isFollowing && distanceFromEnd > transcriptPinnedEndThreshold;
}

interface TranscriptRowGrowthSnapshot {
    firstRowId: string | null;
    rowCount: number;
    tailEntryItemCount: number;
    tailEntryItemsKey: string | null;
    tailEntryRowId: string | null;
}

type TranscriptTurnRenderRow = Extract<TranscriptRenderRow, { kind: 'entry' }> & {
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
};

export function getTranscriptRowGrowthSnapshot(
    rows: TranscriptRenderRow[]
): TranscriptRowGrowthSnapshot {
    const tailEntry = getTailEntryRow(rows);

    return {
        firstRowId: rows[0]?.id ?? null,
        rowCount: rows.length,
        tailEntryItemCount: tailEntry?.entry.items.length ?? 0,
        tailEntryItemsKey: tailEntry
            ? tailEntry.entry.items.map(getTranscriptItemKey).join('\u0000')
            : null,
        tailEntryRowId: tailEntry?.id ?? null,
    };
}

export function shouldFollowTailGrowth({
    isFollowing,
    next,
    previous,
}: {
    isFollowing: boolean;
    next: TranscriptRowGrowthSnapshot;
    previous: TranscriptRowGrowthSnapshot | null;
}) {
    if (!(isFollowing && previous && previous.rowCount > 0)) {
        return false;
    }

    if (next.firstRowId !== previous.firstRowId) {
        return false;
    }

    if (next.rowCount > previous.rowCount) {
        return true;
    }

    return Boolean(
        next.rowCount === previous.rowCount &&
            next.tailEntryRowId === previous.tailEntryRowId &&
            next.tailEntryItemsKey !== previous.tailEntryItemsKey &&
            next.tailEntryItemCount > previous.tailEntryItemCount
    );
}

function getTailEntryRow(rows: TranscriptRenderRow[]): TranscriptTurnRenderRow | null {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (isTranscriptTurnRenderRow(row)) {
            return row;
        }
    }

    return null;
}

function isTranscriptTurnRenderRow(
    row: TranscriptRenderRow | undefined
): row is TranscriptTurnRenderRow {
    return row?.kind === 'entry' && row.entry.kind === 'turn';
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
