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

export function VirtualizedChatTranscript({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    fetchPreviousPage,
    hasPreviousPage,
    hiddenCount,
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
    isFetchingPreviousPage: boolean;
    rows: TranscriptRenderRow[];
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
    const pendingPrependRef = React.useRef<{
        rowCount: number;
        scrollHeight: number;
        scrollTop: number;
    } | null>(null);
    const virtualizer = useVirtualizer({
        count: rows.length,
        estimateSize: (index) => getEstimatedTranscriptRowSize(rows[index]),
        getItemKey: (index) => rows[index]?.id ?? index,
        getScrollElement: () => scrollViewportRef.current,
        overscan: 8,
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

        const scrollElement = scrollViewportRef.current;

        if (scrollElement) {
            pendingPrependRef.current = {
                rowCount: rows.length,
                scrollHeight: scrollElement.scrollHeight,
                scrollTop: scrollElement.scrollTop,
            };
        }

        fetchPreviousPage();
    }, [
        fetchPreviousPage,
        firstEntryIndex,
        hasPreviousPage,
        hiddenCount,
        isFetchingPreviousPage,
        rows.length,
        scrollViewportRef.current,
    ]);

    React.useLayoutEffect(() => {
        const pendingPrepend = pendingPrependRef.current;
        const scrollElement = scrollViewportRef.current;

        if (!(pendingPrepend && scrollElement)) {
            return;
        }

        if (rows.length <= pendingPrepend.rowCount) {
            if (!isFetchingPreviousPage) {
                pendingPrependRef.current = null;
            }
            return;
        }

        const heightDelta = scrollElement.scrollHeight - pendingPrepend.scrollHeight;
        scrollElement.scrollTop = pendingPrepend.scrollTop + Math.max(heightDelta, 0);
        pendingPrependRef.current = null;
    });

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
