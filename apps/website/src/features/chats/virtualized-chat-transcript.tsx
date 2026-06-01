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

const initialScrollToEndFrames = 12;

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
    const virtualizer = useVirtualizer({
        count: rows.length,
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        anchorTo: 'end',
        followOnAppend: true,
        overscan: 8,
        scrollEndThreshold: 72,
    });
    const virtualItems = virtualizer.getVirtualItems();
    const firstEntryIndex = virtualItems.find((item) => rows[item.index]?.kind === 'entry')?.index;

    React.useEffect(() => {
        if (
            firstEntryIndex === undefined ||
            firstEntryIndex > (hiddenCount > 0 ? 3 : 2) ||
            !hasPreviousPage ||
            isFetchingPreviousPage ||
            !fetchPreviousPage
        ) {
            return;
        }

        fetchPreviousPage();
    }, [fetchPreviousPage, firstEntryIndex, hasPreviousPage, hiddenCount, isFetchingPreviousPage]);

    React.useLayoutEffect(() => {
        if (!(initialScrollKey && rows.length > 0)) {
            return;
        }

        let frameCount = 0;
        let animationFrame: number | null = null;

        const scrollToInitialEnd = () => {
            frameCount += 1;
            virtualizer.scrollToEnd({ behavior: 'auto' });

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
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualItems.map((virtualItem) => {
                const row = rows[virtualItem.index];

                if (!row) {
                    return null;
                }

                return (
                    <div
                        className="absolute top-0 left-0 w-full"
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
