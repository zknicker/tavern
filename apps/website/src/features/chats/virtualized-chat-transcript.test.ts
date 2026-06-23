import { expect, test } from 'bun:test';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    buildTranscriptRenderRows,
    getEstimatedTranscriptRowSize,
} from './chat-transcript-row-model.ts';
import {
    getEstimatedTranscriptOffsetForIndex,
    getRenderedVirtualizedChatAnchorScrollCorrection,
    getVirtualizedChatAnchorRestoreTarget,
    getVirtualizedChatScrollAnchorSnapshot,
    getVirtualizedChatScrollAnchorSnapshotFromRenderedRows,
    getVirtualizedChatScrollAnchorSnapshotFromState,
    shouldDeferVirtualizedChatOffsetRestore,
} from './virtualized-chat-scroll-anchor.ts';
import {
    getChatVirtualizerScrollBehavior,
    getEstimatedTranscriptBottomOffset,
    getEstimatedTranscriptTailVirtualItems,
    shouldLoadPreviousVirtualizedChatPage,
    shouldReconcileVirtualizedTranscriptEnd,
} from './virtualized-chat-transcript.tsx';

test('virtualized chat loads previous rows only when the real viewport is near top', () => {
    expect(
        shouldLoadPreviousVirtualizedChatPage({
            firstEntryIndex: 1,
            hasHiddenCount: true,
            hasPreviousPage: true,
            isFetchingPreviousPage: false,
            scrollTop: 0,
        })
    ).toBe(true);

    expect(
        shouldLoadPreviousVirtualizedChatPage({
            firstEntryIndex: 1,
            hasHiddenCount: true,
            hasPreviousPage: true,
            isFetchingPreviousPage: false,
            scrollTop: 480,
        })
    ).toBe(false);
});

test('virtualized chat initial offset starts at the estimated transcript bottom', () => {
    const rows = [
        { id: 'hidden-count', kind: 'hiddenCount' },
        {
            entry: {
                actor: null,
                id: 'user-row',
                items: [],
                key: 'user:test',
                kind: 'turn',
                participant: 'user',
                responseId: null,
                timestamp: null,
            },
            id: 'user-row',
            kind: 'entry',
        },
        {
            entry: {
                actor: null,
                id: 'agent-row',
                items: [],
                key: 'agent:test',
                kind: 'turn',
                participant: 'agent',
                responseId: null,
                timestamp: null,
            },
            id: 'agent-row',
            kind: 'entry',
        },
    ] as TranscriptRenderRow[];

    expect(getEstimatedTranscriptBottomOffset(rows, 120)).toBe(204);
    expect(getEstimatedTranscriptBottomOffset(rows, 120, 64)).toBe(268);
    expect(getEstimatedTranscriptBottomOffset(rows, 400)).toBe(0);
});

test('virtualized chat fallback renders the estimated tail when the measured range is empty', () => {
    const rows = [
        { id: 'hidden-count', kind: 'hiddenCount' },
        {
            entry: {
                actor: null,
                id: 'user-row',
                items: [],
                key: 'user:test',
                kind: 'turn',
                participant: 'user',
                responseId: null,
                timestamp: null,
            },
            id: 'user-row',
            kind: 'entry',
        },
        {
            entry: {
                actor: null,
                id: 'agent-row',
                items: [],
                key: 'agent:test',
                kind: 'turn',
                participant: 'agent',
                responseId: null,
                timestamp: null,
            },
            id: 'agent-row',
            kind: 'entry',
        },
    ] as TranscriptRenderRow[];

    expect(getEstimatedTranscriptTailVirtualItems(rows, 120).map((item) => item.key)).toEqual([
        'hidden-count',
        'user-row',
        'agent-row',
    ]);
    expect(getEstimatedTranscriptTailVirtualItems(rows, 40, 64).map((item) => item.key)).toEqual([
        'hidden-count',
        'user-row',
        'agent-row',
    ]);
    expect(getEstimatedTranscriptTailVirtualItems(rows, 0)).toEqual([]);
});

test('virtualized chat fallback keeps rendering the tail when the viewport is inside the end inset', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
        id: `day-${index}`,
        kind: 'dayDivider',
        label: 'Today',
    })) satisfies TranscriptRenderRow[];

    expect(getEstimatedTranscriptTailVirtualItems(rows, 40, 64).map((item) => item.key)).toEqual([
        'day-3',
        'day-4',
        'day-5',
        'day-6',
        'day-7',
        'day-8',
        'day-9',
        'day-10',
        'day-11',
    ]);
});

test('virtualized chat keeps implicit size adjustments instant while following', () => {
    expect(getChatVirtualizerScrollBehavior({})).toBe('auto');
});

test('virtualized chat respects explicit scroll behavior requests', () => {
    expect(
        getChatVirtualizerScrollBehavior({
            requestedBehavior: 'smooth',
        })
    ).toBe('smooth');
});

test('virtualized chat reconciles the measured end while following', () => {
    expect(
        shouldReconcileVirtualizedTranscriptEnd({ distanceFromEnd: 64, mode: 'following' })
    ).toBe(true);
    expect(shouldReconcileVirtualizedTranscriptEnd({ distanceFromEnd: 0, mode: 'following' })).toBe(
        false
    );
    expect(shouldReconcileVirtualizedTranscriptEnd({ distanceFromEnd: 64, mode: 'free' })).toBe(
        false
    );
});

test('virtualized chat captures the first visible row as a restorable anchor', () => {
    const rows = transcriptRows(['one', 'two', 'three']);

    expect(
        getVirtualizedChatScrollAnchorSnapshot({
            isAtBottom: false,
            rows,
            scrollTop: 150,
            virtualItems: [
                virtualItem({ end: 100, index: 0, key: 'one', size: 100, start: 0 }),
                virtualItem({ end: 220, index: 1, key: 'two', size: 100, start: 120 }),
                virtualItem({ end: 340, index: 2, key: 'three', size: 100, start: 240 }),
            ],
        })
    ).toEqual({ atBottom: false, offsetPx: 30, rowId: 'two' });
});

test('virtualized chat captures rendered row anchors from viewport geometry', () => {
    expect(
        getVirtualizedChatScrollAnchorSnapshotFromRenderedRows({
            isAtBottom: false,
            renderedRows: [
                { bottom: 90, height: 80, rowId: 'one', top: 10 },
                { bottom: 240, height: 140, rowId: 'two', top: 100 },
            ],
            viewportTop: 150,
        })
    ).toEqual({ atBottom: false, offsetPx: 50, rowId: 'two' });
});

test('virtualized chat stores bottom state instead of a row anchor at the tail', () => {
    expect(
        getVirtualizedChatScrollAnchorSnapshot({
            isAtBottom: true,
            rows: transcriptRows(['one']),
            scrollTop: 0,
            virtualItems: [virtualItem({ end: 100, index: 0, key: 'one', size: 100, start: 0 })],
        })
    ).toEqual({ atBottom: true });
});

test('virtualized chat capture trusts physical end state over stale following mode', () => {
    const rows = transcriptRows(['one', 'two', 'three']);

    expect(
        getVirtualizedChatScrollAnchorSnapshotFromState({
            isAtEnd: false,
            mode: 'following',
            rows,
            scrollTop: 150,
            virtualItems: [
                virtualItem({ end: 100, index: 0, key: 'one', size: 100, start: 0 }),
                virtualItem({ end: 220, index: 1, key: 'two', size: 100, start: 120 }),
                virtualItem({ end: 340, index: 2, key: 'three', size: 100, start: 240 }),
            ],
        })
    ).toEqual({ atBottom: false, offsetPx: 30, rowId: 'two' });
});

test('virtualized chat restores row anchors from measured items first', () => {
    const rows = transcriptRows(['one', 'two', 'three']);

    expect(
        getVirtualizedChatAnchorRestoreTarget({
            anchor: { atBottom: false, offsetPx: 24, rowId: 'two' },
            rows,
            virtualItems: [virtualItem({ end: 200, index: 1, key: 'two', size: 80, start: 120 })],
        })
    ).toEqual({ kind: 'offset', measured: true, offset: 144 });
});

test('virtualized chat falls back to estimated row offsets before measurement', () => {
    const rows = transcriptRows(['one', 'two', 'three']);

    expect(getEstimatedTranscriptOffsetForIndex(rows, 2)).toBe(200);
    expect(
        getVirtualizedChatAnchorRestoreTarget({
            anchor: { atBottom: false, offsetPx: 28, rowId: 'three' },
            rows,
            virtualItems: [],
        })
    ).toEqual({ kind: 'offset', measured: false, offset: 228 });
});

test('virtualized chat defers nonzero anchor restores until scroll capacity exists', () => {
    expect(
        shouldDeferVirtualizedChatOffsetRestore({
            hasScrollElement: true,
            maxScrollOffset: 0,
            targetOffset: 228,
        })
    ).toBe(true);
    expect(
        shouldDeferVirtualizedChatOffsetRestore({
            hasScrollElement: false,
            maxScrollOffset: 500,
            targetOffset: 228,
        })
    ).toBe(true);
    expect(
        shouldDeferVirtualizedChatOffsetRestore({
            hasScrollElement: true,
            maxScrollOffset: 500,
            targetOffset: 228,
        })
    ).toBe(false);
});

test('virtualized chat corrects rendered anchor restores with viewport geometry', () => {
    expect(
        getRenderedVirtualizedChatAnchorScrollCorrection({
            anchorOffsetPx: 532,
            rowTop: -181,
            viewportTop: 0,
        })
    ).toBe(351);
    expect(
        getRenderedVirtualizedChatAnchorScrollCorrection({
            anchorOffsetPx: 532,
            rowTop: -532,
            viewportTop: 0,
        })
    ).toBe(0);
});

test('virtualized chat treats missing anchor rows as stale', () => {
    expect(
        getVirtualizedChatAnchorRestoreTarget({
            anchor: { atBottom: false, offsetPx: 8, rowId: 'gone' },
            rows: transcriptRows(['one', 'two']),
            virtualItems: [],
        })
    ).toEqual({ kind: 'missing' });
});

test('virtualized chat estimates blank thinking presence without fake bottom space', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [],
    });
    const rows = buildTranscriptRenderRows(entries, 0);

    expect(getEstimatedTranscriptBottomOffset(rows, 120)).toBe(0);
});

test('virtualized chat does not reserve reply space for hidden thinking progress', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [thinkingRow('thinking-1')],
        showThinkingText: false,
    });
    const rows = buildTranscriptRenderRows(entries, 0);

    const agentRow = rows.find((row) => row.kind === 'entry');

    expect(rows.map((row) => row.kind)).toEqual(['dayDivider', 'entry']);
    expect(agentRow?.kind === 'entry' ? agentRow.showPresence : false).toBe(true);
    expect(getEstimatedTranscriptRowSize(agentRow)).toBe(56);
});

test('virtualized chat keeps the agent row stable when first visible reply appears', () => {
    const thinkingReply = {
        agentId: 'agent-1',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-05-11T16:00:00.000Z',
        text: '',
    };
    const streamingReply = {
        ...thinkingReply,
        isThinking: false,
        text: 'Visible now.',
    };
    const thinkingRows = buildTranscriptRenderRows(
        buildTranscriptEntries({
            activeReply: thinkingReply,
            rows: [thinkingRow('thinking-1')],
            showThinkingText: false,
        }),
        0
    );
    const streamingRows = buildTranscriptRenderRows(
        buildTranscriptEntries({
            activeReply: streamingReply,
            rows: [thinkingRow('thinking-1')],
            showThinkingText: false,
        }),
        0
    );

    const thinkingAgentRow = thinkingRows.at(-1);
    const streamingAgentRow = streamingRows.at(-1);

    expect(thinkingRows.map((row) => row.kind)).toEqual(['dayDivider', 'entry']);
    expect(streamingRows.map((row) => row.kind)).toEqual(['dayDivider', 'entry']);
    expect(thinkingAgentRow?.id).toBe(streamingAgentRow?.id);
    expect(thinkingAgentRow?.kind === 'entry' ? thinkingAgentRow.showPresence : false).toBe(true);
    expect(streamingAgentRow?.kind === 'entry' ? streamingAgentRow.showPresence : false).toBe(true);
});

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];

function transcriptRows(ids: string[]) {
    return ids.map((id) => ({
        entry: {
            actor: null,
            id,
            items: [],
            key: `user:${id}`,
            kind: 'turn',
            participant: 'user',
            responseId: null,
            timestamp: null,
        },
        followsRuntimeNotice: false,
        id,
        kind: 'entry',
        showPresence: false,
        turnStartedAt: null,
    })) satisfies TranscriptRenderRow[];
}

function virtualItem({
    end,
    index,
    key,
    size,
    start,
}: {
    end: number;
    index: number;
    key: string;
    size: number;
    start: number;
}) {
    return { end, index, key, lane: 0, size, start } satisfies VirtualItem;
}

function thinkingRow(id: string): ChatRow {
    return {
        id,
        kind: 'system',
        systemKind: 'thinking',
        thinking: {
            id,
            messageId: 'run-1',
            sender: 'Agent',
            text: 'Need to inspect the files before replying.',
            timestamp: '2026-05-11T16:00:01.000Z',
        },
        timestamp: '2026-05-11T16:00:01.000Z',
    };
}
