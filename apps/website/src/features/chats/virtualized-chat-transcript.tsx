import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import {
    getEstimatedTranscriptRowSize,
    type TranscriptRenderRow,
} from './chat-transcript-row-model.ts';
import { TranscriptEntryRow } from './chat-transcript-rows.tsx';
import {
    transcriptDisclosureAnchorEndEvent,
    transcriptDisclosureAnchorStartEvent,
} from './chat-transcript-scroll-anchor.ts';

const initialScrollToEndFrames = 12;
const previousPageScrollThreshold = 160;

export function VirtualizedChatTranscript({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    fetchPreviousPage,
    hasPreviousPage,
    hiddenCount,
    initialScrollKey,
    isFetchingPreviousPage,
    rows,
    scrollViewportRef,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    fetchPreviousPage?: () => void;
    hasPreviousPage: boolean;
    hiddenCount: number;
    initialScrollKey?: string | null;
    isFetchingPreviousPage: boolean;
    rows: TranscriptRenderRow[];
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const disclosureAnchorActiveRef = React.useRef(false);
    const virtualizer = useVirtualizer({
        count: rows.length,
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        overscan: 8,
    });
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item) => {
        const viewport = scrollViewportRef.current;

        return Boolean(
            viewport && !disclosureAnchorActiveRef.current && item.start < viewport.scrollTop
        );
    };
    const virtualItems = virtualizer.getVirtualItems();
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;

    React.useEffect(() => {
        const handleAnchorStart = () => {
            disclosureAnchorActiveRef.current = true;
        };
        const handleAnchorEnd = () => {
            disclosureAnchorActiveRef.current = false;
        };

        window.addEventListener(transcriptDisclosureAnchorStartEvent, handleAnchorStart);
        window.addEventListener(transcriptDisclosureAnchorEndEvent, handleAnchorEnd);

        return () => {
            window.removeEventListener(transcriptDisclosureAnchorStartEvent, handleAnchorStart);
            window.removeEventListener(transcriptDisclosureAnchorEndEvent, handleAnchorEnd);
        };
    }, []);

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

    React.useLayoutEffect(() => {
        if (!(initialScrollKey && rows.length > 0)) {
            return;
        }

        let frameCount = 0;
        let animationFrame: number | null = null;

        const scrollToInitialEnd = () => {
            frameCount += 1;
            virtualizer.scrollToIndex(rows.length - 1, {
                align: 'end',
                behavior: 'auto',
            });

            if (frameCount < initialScrollToEndFrames) {
                animationFrame = requestAnimationFrame(scrollToInitialEnd);
            }
        };

        scrollToInitialEnd();

        return () => {
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [initialScrollKey, rows.length, virtualizer]);

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
                                activeReply={activeReply}
                                chatId={chatId}
                                conversationLayout={conversationLayout}
                                currentSessionKey={currentSessionKey}
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
