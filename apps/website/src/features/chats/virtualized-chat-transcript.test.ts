import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    buildTranscriptRenderRows,
    getEstimatedTranscriptRowSize,
} from './chat-transcript-row-model.ts';
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
