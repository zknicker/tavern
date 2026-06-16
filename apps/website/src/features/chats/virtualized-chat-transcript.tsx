import {
    measureElement as measureVirtualElement,
    type ReactVirtualizer,
    type Rect,
    useVirtualizer,
    type VirtualItem,
} from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { ActiveReplyLayoutSyncProvider } from './active-reply-layout-sync.tsx';
import {
    shouldAdjustVirtualizerOnItemSizeChange,
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
import { useChatScrollControllerMode } from './use-chat-scroll-controller.ts';

const previousPageScrollThreshold = 160;
const transcriptScrollEndThreshold = 72;
const transcriptFallbackOverscan = 8;

export function VirtualizedChatTranscript({
    activeReply,
    activePresenceVerb = null,
    agentPresenceColor = null,
    animateMessages,
    chatId,
    conversationLayout,
    currentSessionKey,
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
    const activeRowElementRef = React.useRef<HTMLDivElement | null>(null);
    const initialScrollKeyRef = React.useRef<string | null>(null);
    const initialScrollMeasureKeyRef = React.useRef<string | null>(null);
    const initialScrollPendingRef = React.useRef(false);
    const chatScrollMode = useChatScrollControllerMode();
    const virtualizerAnchorsToEnd = shouldAnchorVirtualizerToEnd(chatScrollMode);
    const virtualizerAdjustsItemSize = shouldAdjustVirtualizerOnItemSizeChange(chatScrollMode);
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        anchorTo: virtualizerAnchorsToEnd ? 'end' : 'start',
        count: rows.length,
        directDomUpdates: true,
        directDomUpdatesMode: 'transform',
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        followOnAppend: true,
        gap: transcriptRenderRowGap,
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        initialRect: getInitialTranscriptViewportRect(scrollViewportRef.current),
        initialOffset: () =>
            getEstimatedTranscriptBottomOffset(
                rows,
                getInitialTranscriptViewportHeight(scrollViewportRef.current)
            ),
        measureElement: (element, entry, instance) => {
            const index = instance.indexFromElement(element);

            if (transcriptRowUsesActiveReply(rows[index], activeReply)) {
                return Math.round(element.getBoundingClientRect().height);
            }

            return measureVirtualElement(element, entry, instance);
        },
        overscan: 8,
        scrollEndThreshold: transcriptScrollEndThreshold,
    });
    const totalSize = virtualizer.getTotalSize();
    const initialScrollMeasureKey = `${rows.length}:${totalSize}`;
    const tailFollowKey = getVirtualizedTranscriptTailFollowKey(rows, activeReply);
    const scrollToEndIfNearEnd = React.useCallback(() => {
        if (virtualizer.isAtEnd(transcriptScrollEndThreshold)) {
            virtualizer.scrollToEnd({ behavior: 'auto' });
        }
    }, [virtualizer]);
    const syncActiveReplyLayout = React.useCallback(() => {
        const activeRowElement = activeRowElementRef.current;
        const shouldFollowEnd = virtualizer.isAtEnd(transcriptScrollEndThreshold);

        if (activeRowElement) {
            virtualizer.measureElement(activeRowElement);
        }

        if (shouldFollowEnd) {
            virtualizer.scrollToEnd({ behavior: 'auto' });
        }
    }, [virtualizer]);
    const virtualItems = virtualizer.getVirtualItems();
    const usingEstimatedTail = virtualItems.length === 0;
    const renderableVirtualItems = usingEstimatedTail
        ? getEstimatedTranscriptTailVirtualItems(
              rows,
              getInitialTranscriptViewportHeight(scrollViewportRef.current)
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
                !virtualizer.isAtEnd(transcriptScrollEndThreshold)
            ) {
                virtualizer.scrollToEnd({ behavior: 'auto' });
                return;
            }

            if (initialScrollPendingRef.current && (keyChanged || measureChanged)) {
                initialScrollPendingRef.current = false;
            }
        }
    }, [initialScrollKey, initialScrollMeasureKey, rows.length, virtualizer]);

    React.useLayoutEffect(() => {
        if (tailFollowKey.length === 0) {
            return;
        }

        scrollToEndIfNearEnd();
    }, [scrollToEndIfNearEnd, tailFollowKey]);

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
        <ActiveReplyLayoutSyncProvider value={syncActiveReplyLayout}>
            <div className="relative w-full [overflow-anchor:none]" ref={virtualizer.containerRef}>
                {renderableVirtualItems.map((virtualItem) => {
                    const row = rows[virtualItem.index];

                    if (!row) {
                        return null;
                    }

                    const measuresActiveReply = transcriptRowUsesActiveReply(row, activeReply);
                    const rendersActiveReply = transcriptRenderRowUsesActiveReply(row, activeReply);

                    return (
                        <TranscriptVirtualRow
                            activeRowElementRef={activeRowElementRef}
                            key={virtualItem.key}
                            positionsWithReact={usingEstimatedTail}
                            usesActiveReply={measuresActiveReply}
                            virtualItem={virtualItem}
                            virtualizer={virtualizer}
                        >
                            <TranscriptRenderRowView
                                activePresenceVerb={
                                    row.kind === 'presence' ? activePresenceVerb : null
                                }
                                activeReply={rendersActiveReply ? activeReply : null}
                                agentPresenceColor={agentPresenceColor}
                                animateMessages={animateMessages}
                                chatId={chatId}
                                conversationLayout={conversationLayout}
                                currentSessionKey={currentSessionKey}
                                failedTurn={failedTurn}
                                hiddenCount={hiddenCount}
                                presenceRows={presenceRows}
                                row={row}
                            />
                        </TranscriptVirtualRow>
                    );
                })}
            </div>
        </ActiveReplyLayoutSyncProvider>
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
    activeRowElementRef,
    children,
    positionsWithReact,
    usesActiveReply,
    virtualItem,
    virtualizer,
}: {
    activeRowElementRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode;
    positionsWithReact: boolean;
    usesActiveReply: boolean;
    virtualItem: VirtualItem;
    virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
}) {
    const measureRowElement = React.useCallback(
        (element: HTMLDivElement | null) => {
            virtualizer.measureElement(element);

            if (usesActiveReply) {
                activeRowElementRef.current = element;
                return;
            }

            if (activeRowElementRef.current === element) {
                activeRowElementRef.current = null;
            }
        },
        [activeRowElementRef, usesActiveReply, virtualizer]
    );

    return (
        <div
            className="absolute top-0 left-0 w-full [overflow-anchor:none]"
            data-index={virtualItem.index}
            ref={measureRowElement}
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

export function transcriptRowUsesActiveReply(
    row: TranscriptRenderRow | undefined,
    activeReply: ChatActiveReply | null
) {
    return (
        row?.kind === 'entry' &&
        row.entry.kind === 'turn' &&
        Boolean(activeReply) &&
        row.entry.items.some((item) => item.kind === 'activeReply')
    );
}

export function getVirtualizedTranscriptTailFollowKey(
    rows: TranscriptRenderRow[],
    activeReply: ChatActiveReply | null
) {
    const tailRowIds = rows
        .slice(-3)
        .map((row) => row.id)
        .join('|');
    const activeReplyState = activeReply
        ? `${activeReply.runId}:${activeReply.completedAt ?? 'live'}`
        : 'idle';

    return `${tailRowIds || 'none'}:${activeReplyState}`;
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
    const totalEstimatedHeight = getEstimatedTranscriptRowsSize(rows);

    return Math.max(totalEstimatedHeight - viewportHeight, 0);
}

export function getEstimatedTranscriptTailVirtualItems(
    rows: TranscriptRenderRow[],
    viewportHeight: number
): VirtualItem[] {
    if (rows.length === 0 || viewportHeight <= 0) {
        return [];
    }

    const items = buildEstimatedTranscriptVirtualItems(rows);
    const totalEstimatedHeight = items.at(-1)?.end ?? 0;
    const visibleStart = Math.max(totalEstimatedHeight - viewportHeight, 0);
    const firstVisibleIndex = items.findIndex((item) => item.end >= visibleStart);
    const startIndex = Math.max(
        (firstVisibleIndex === -1 ? 0 : firstVisibleIndex) - transcriptFallbackOverscan,
        0
    );

    return items.slice(startIndex);
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
