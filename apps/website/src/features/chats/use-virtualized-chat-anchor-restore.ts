import type { ReactVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import * as React from 'react';
import {
    type ChatScrollAnchorSnapshot,
    readChatScrollAnchor,
} from './chat-scroll-anchor-memory.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import type { ChatScrollControllerHandle } from './use-chat-scroll-controller.ts';
import {
    getRenderedVirtualizedChatAnchorScrollCorrection,
    getVirtualizedChatAnchorRestoreTarget,
    shouldDeferVirtualizedChatOffsetRestore,
} from './virtualized-chat-scroll-anchor.ts';

const anchorRestoreMaxAttempts = 30;

export function useVirtualizedChatAnchorRestore({
    anchorRestorePendingRef,
    chatId,
    chatScrollController,
    initialScrollKey,
    initialScrollMeasureKey,
    initialScrollPendingRef,
    pinnedEndThreshold,
    rows,
    virtualItems,
    virtualizer,
}: {
    anchorRestorePendingRef: React.MutableRefObject<boolean>;
    chatId?: string;
    chatScrollController: ChatScrollControllerHandle | null;
    initialScrollKey: string | null;
    initialScrollMeasureKey: string;
    initialScrollPendingRef: React.MutableRefObject<boolean>;
    pinnedEndThreshold: number;
    rows: TranscriptRenderRow[];
    virtualItems: VirtualItem[];
    virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
}) {
    const initialScrollKeyRef = React.useRef<string | null>(null);
    const initialScrollMeasureKeyRef = React.useRef<string | null>(null);
    const anchorRestoreRef = React.useRef<PendingAnchorRestore | null>(null);
    const [anchorRestoreTick, setAnchorRestoreTick] = React.useState(0);

    if (
        initialScrollKey &&
        rows.length > 0 &&
        initialScrollKeyRef.current !== initialScrollKey &&
        !anchorRestoreRef.current &&
        getRestorableChatScrollAnchor(readChatScrollAnchor(chatId), rows)
    ) {
        anchorRestorePendingRef.current = true;
    }

    const clearAnchorRestore = React.useCallback(() => {
        const anchorRestore = anchorRestoreRef.current;

        if (!anchorRestore) {
            anchorRestorePendingRef.current = false;
            return;
        }

        anchorRestoreRef.current = null;
        anchorRestorePendingRef.current = false;

        if (anchorRestore.frameId !== null) {
            window.cancelAnimationFrame(anchorRestore.frameId);
        }
    }, [anchorRestorePendingRef]);

    const scheduleAnchorRestoreRetry = React.useCallback(() => {
        const anchorRestore = anchorRestoreRef.current;

        if (
            !anchorRestore ||
            anchorRestore.frameId !== null ||
            anchorRestore.attempts >= anchorRestoreMaxAttempts
        ) {
            return;
        }

        anchorRestore.frameId = window.requestAnimationFrame(() => {
            if (anchorRestoreRef.current !== anchorRestore) {
                return;
            }

            anchorRestore.frameId = null;
            setAnchorRestoreTick((version) => version + 1);
        });
    }, []);

    React.useLayoutEffect(() => {
        const measureChanged = initialScrollMeasureKeyRef.current !== initialScrollMeasureKey;
        initialScrollMeasureKeyRef.current = initialScrollMeasureKey;

        if (!(initialScrollKey && rows.length > 0)) {
            return;
        }

        const keyChanged = initialScrollKeyRef.current !== initialScrollKey;
        const shouldAttemptAnchorRestore = keyChanged || measureChanged || anchorRestoreTick > 0;

        if (keyChanged) {
            const savedAnchor = readChatScrollAnchor(chatId);
            const restoreAnchor = getRestorableChatScrollAnchor(savedAnchor, rows);

            if (restoreAnchor) {
                initialScrollPendingRef.current = false;
                anchorRestorePendingRef.current = true;
                anchorRestoreRef.current = {
                    anchor: restoreAnchor,
                    attempts: 0,
                    frameId: null,
                    key: initialScrollKey,
                };
                chatScrollController?.restoreScrollPosition({ isAtBottom: false });
            } else {
                clearAnchorRestore();
                initialScrollPendingRef.current = true;
                chatScrollController?.restoreScrollPosition({ isAtBottom: true });
            }
        }

        initialScrollKeyRef.current = initialScrollKey;

        const pendingAnchorRestore = anchorRestoreRef.current;

        if (pendingAnchorRestore?.key === initialScrollKey && shouldAttemptAnchorRestore) {
            const target = getVirtualizedChatAnchorRestoreTarget({
                anchor: pendingAnchorRestore.anchor,
                rows,
                virtualItems,
            });

            if (target.kind === 'missing') {
                clearAnchorRestore();
                initialScrollPendingRef.current = true;
            } else if (target.kind === 'offset') {
                const scrollElement = virtualizer.scrollElement;
                const renderedAnchorCorrection = scrollElement
                    ? getRenderedAnchorScrollCorrection(scrollElement, pendingAnchorRestore.anchor)
                    : null;

                if (scrollElement && renderedAnchorCorrection !== null) {
                    if (Math.abs(renderedAnchorCorrection) <= 1) {
                        clearAnchorRestore();
                        return;
                    }

                    virtualizer.scrollToOffset(scrollElement.scrollTop + renderedAnchorCorrection, {
                        behavior: 'auto',
                    });
                    pendingAnchorRestore.attempts += 1;

                    if (pendingAnchorRestore.attempts >= anchorRestoreMaxAttempts) {
                        clearAnchorRestore();
                    } else {
                        scheduleAnchorRestoreRetry();
                    }

                    return;
                }

                if (
                    shouldDeferVirtualizedChatOffsetRestore({
                        hasScrollElement: scrollElement !== null,
                        maxScrollOffset: scrollElement
                            ? scrollElement.scrollHeight - scrollElement.clientHeight
                            : 0,
                        targetOffset: target.offset,
                    })
                ) {
                    pendingAnchorRestore.attempts += 1;

                    if (pendingAnchorRestore.attempts >= anchorRestoreMaxAttempts) {
                        clearAnchorRestore();
                    } else {
                        scheduleAnchorRestoreRetry();
                    }

                    return;
                }

                virtualizer.scrollToOffset(target.offset, { behavior: 'auto' });

                if (
                    target.measured &&
                    scrollElement &&
                    Math.abs(scrollElement.scrollTop - target.offset) <= 1
                ) {
                    clearAnchorRestore();
                    return;
                }

                pendingAnchorRestore.attempts += 1;

                if (pendingAnchorRestore.attempts >= anchorRestoreMaxAttempts) {
                    clearAnchorRestore();
                } else {
                    scheduleAnchorRestoreRetry();
                }

                return;
            }
        }

        if (
            initialScrollPendingRef.current &&
            (keyChanged || measureChanged) &&
            !virtualizer.isAtEnd(pinnedEndThreshold)
        ) {
            virtualizer.scrollToEnd({ behavior: 'auto' });
            return;
        }

        if (initialScrollPendingRef.current && (keyChanged || measureChanged)) {
            initialScrollPendingRef.current = false;
        }
    }, [
        anchorRestoreTick,
        anchorRestorePendingRef,
        chatId,
        chatScrollController,
        clearAnchorRestore,
        initialScrollKey,
        initialScrollMeasureKey,
        initialScrollPendingRef,
        pinnedEndThreshold,
        rows,
        scheduleAnchorRestoreRetry,
        virtualItems,
        virtualizer,
    ]);

    React.useEffect(() => clearAnchorRestore, [clearAnchorRestore]);

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
    }, [initialScrollKey, initialScrollPendingRef]);
}

interface PendingAnchorRestore {
    anchor: Extract<ChatScrollAnchorSnapshot, { atBottom: false }>;
    attempts: number;
    frameId: number | null;
    key: string;
}

function getRestorableChatScrollAnchor(
    anchor: ChatScrollAnchorSnapshot | null,
    rows: TranscriptRenderRow[]
): Extract<ChatScrollAnchorSnapshot, { atBottom: false }> | null {
    if (!anchor || anchor.atBottom) {
        return null;
    }

    return rows.some((row) => row.id === anchor.rowId) ? anchor : null;
}

function getRenderedAnchorScrollCorrection(
    scrollElement: HTMLElement,
    anchor: Extract<ChatScrollAnchorSnapshot, { atBottom: false }>
) {
    const rowElement = Array.from(
        scrollElement.querySelectorAll<HTMLElement>('[data-chat-transcript-row-id]')
    ).find((element) => element.getAttribute('data-chat-transcript-row-id') === anchor.rowId);

    if (!rowElement) {
        return null;
    }

    const viewportTop = scrollElement.getBoundingClientRect().top;
    const rowTop = rowElement.getBoundingClientRect().top;

    return getRenderedVirtualizedChatAnchorScrollCorrection({
        anchorOffsetPx: anchor.offsetPx,
        rowTop,
        viewportTop,
    });
}
