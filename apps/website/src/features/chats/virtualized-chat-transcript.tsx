import {
    measureElement as measureVirtualElement,
    type ReactVirtualizer,
    useVirtualizer,
    type VirtualItem,
} from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { ActiveReplyLayoutSyncProvider } from './active-reply-layout-sync.tsx';
import type { ConversationMessageLayout, TranscriptRow } from './chat-transcript-model.ts';
import {
    getEstimatedTranscriptRowSize,
    type TranscriptRenderRow,
    transcriptRenderRowUsesActiveReply,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowView } from './chat-transcript-rows.tsx';

const previousPageScrollThreshold = 160;
const transcriptScrollEndThreshold = 72;

export function VirtualizedChatTranscript({
    activeReply,
    agentPresenceColor = null,
    animateMessages,
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
    animateMessages: boolean;
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
    const activeRowElementRef = React.useRef<HTMLDivElement | null>(null);
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        anchorTo: 'end',
        count: rows.length,
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        followOnAppend: true,
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
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
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;

    React.useLayoutEffect(() => {
        if (tailFollowKey.length === 0) {
            return;
        }

        scrollToEndIfNearEnd();
    }, [scrollToEndIfNearEnd, tailFollowKey]);

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
            <div
                className="relative w-full [overflow-anchor:none]"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
                {virtualItems.map((virtualItem) => {
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
                            usesActiveReply={measuresActiveReply}
                            virtualItem={virtualItem}
                            virtualizer={virtualizer}
                        >
                            <TranscriptRenderRowView
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

function TranscriptVirtualRow({
    activeRowElementRef,
    children,
    usesActiveReply,
    virtualItem,
    virtualizer,
}: {
    activeRowElementRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode;
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
            style={{
                transform: `translateY(${virtualItem.start}px)`,
            }}
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
