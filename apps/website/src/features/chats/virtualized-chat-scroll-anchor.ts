import type { VirtualItem } from '@tanstack/react-virtual';
import type { ChatScrollAnchorSnapshot } from './chat-scroll-anchor-memory.ts';
import type { ChatScrollMode } from './chat-scroll-mode.ts';
import {
    getEstimatedTranscriptRowSize,
    type TranscriptRenderRow,
    transcriptRenderRowGap,
} from './chat-transcript-row-model.ts';

const anchorOffsetPrecision = 0.5;

export interface VirtualizedChatRenderedRowAnchorInput {
    bottom: number;
    height: number;
    rowId: string | null;
    top: number;
}

export type VirtualizedChatAnchorRestoreTarget =
    | { kind: 'bottom' }
    | { kind: 'missing' }
    | { kind: 'offset'; measured: boolean; offset: number };

export function shouldDeferVirtualizedChatOffsetRestore({
    hasScrollElement,
    maxScrollOffset,
    targetOffset,
}: {
    hasScrollElement: boolean;
    maxScrollOffset: number;
    targetOffset: number;
}) {
    return targetOffset > 0 && (!hasScrollElement || maxScrollOffset <= 0);
}

export function getRenderedVirtualizedChatAnchorScrollCorrection({
    anchorOffsetPx,
    rowTop,
    viewportTop,
}: {
    anchorOffsetPx: number;
    rowTop: number;
    viewportTop: number;
}) {
    return rowTop - viewportTop + anchorOffsetPx;
}

export function getVirtualizedChatScrollAnchorSnapshotFromState({
    isAtEnd,
    rows,
    scrollTop,
    virtualItems,
}: {
    isAtEnd: boolean;
    mode: ChatScrollMode;
    rows: TranscriptRenderRow[];
    scrollTop: number;
    virtualItems: VirtualItem[];
}) {
    // Controller mode can lag one scroll callback behind physical viewport
    // position, so bottom snapshots must use the measured virtualizer end.
    return getVirtualizedChatScrollAnchorSnapshot({
        isAtBottom: isAtEnd,
        rows,
        scrollTop,
        virtualItems,
    });
}

export function getVirtualizedChatScrollAnchorSnapshot({
    isAtBottom,
    rows,
    scrollTop,
    virtualItems,
}: {
    isAtBottom: boolean;
    rows: TranscriptRenderRow[];
    scrollTop: number;
    virtualItems: VirtualItem[];
}): ChatScrollAnchorSnapshot | null {
    if (isAtBottom) {
        return { atBottom: true };
    }

    const firstVisibleItem = virtualItems.find(
        (item) => item.end > scrollTop + anchorOffsetPrecision
    );
    const row = firstVisibleItem ? rows[firstVisibleItem.index] : null;

    if (!(firstVisibleItem && row)) {
        return null;
    }

    return {
        atBottom: false,
        offsetPx: clamp(scrollTop - firstVisibleItem.start, 0, firstVisibleItem.size),
        rowId: row.id,
    };
}

export function getVirtualizedChatScrollAnchorSnapshotFromRenderedRows({
    isAtBottom,
    renderedRows,
    viewportTop,
}: {
    isAtBottom: boolean;
    renderedRows: VirtualizedChatRenderedRowAnchorInput[];
    viewportTop: number;
}): ChatScrollAnchorSnapshot | null {
    if (isAtBottom) {
        return { atBottom: true };
    }

    const firstVisibleRow = renderedRows.find(
        (row) => row.rowId && row.bottom > viewportTop + anchorOffsetPrecision
    );

    if (!firstVisibleRow?.rowId) {
        return null;
    }

    return {
        atBottom: false,
        offsetPx: clamp(viewportTop - firstVisibleRow.top, 0, firstVisibleRow.height),
        rowId: firstVisibleRow.rowId,
    };
}

export function getVirtualizedChatAnchorRestoreTarget({
    anchor,
    rows,
    virtualItems,
}: {
    anchor: ChatScrollAnchorSnapshot;
    rows: TranscriptRenderRow[];
    virtualItems: VirtualItem[];
}): VirtualizedChatAnchorRestoreTarget {
    if (anchor.atBottom) {
        return { kind: 'bottom' };
    }

    const rowIndex = rows.findIndex((row) => row.id === anchor.rowId);

    if (rowIndex === -1) {
        return { kind: 'missing' };
    }

    const measuredItem = virtualItems.find((item) => item.index === rowIndex);
    const rowStart = measuredItem?.start ?? getEstimatedTranscriptOffsetForIndex(rows, rowIndex);
    const rowSize = measuredItem?.size ?? getEstimatedTranscriptRowSize(rows[rowIndex]);

    return {
        kind: 'offset',
        measured: measuredItem !== undefined,
        offset: rowStart + clamp(anchor.offsetPx, 0, rowSize),
    };
}

export function getEstimatedTranscriptOffsetForIndex(
    rows: TranscriptRenderRow[],
    targetIndex: number
) {
    if (targetIndex <= 0) {
        return 0;
    }

    return rows
        .slice(0, targetIndex)
        .reduce(
            (offset, row) => offset + getEstimatedTranscriptRowSize(row) + transcriptRenderRowGap,
            0
        );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
