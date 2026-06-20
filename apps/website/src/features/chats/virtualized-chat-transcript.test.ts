import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries, type TranscriptItem } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    buildTranscriptRenderRows,
    getEstimatedTranscriptRowSize,
} from './chat-transcript-row-model.ts';
import {
    getChatVirtualizerScrollBehavior,
    getEstimatedTranscriptBottomOffset,
    getEstimatedTranscriptTailVirtualItems,
    getTranscriptRowGrowthSnapshot,
    shouldCorrectVirtualizedTranscriptEndGap,
    shouldFollowTailGrowth,
    shouldLoadPreviousVirtualizedChatPage,
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
    expect(
        getChatVirtualizerScrollBehavior({
            hasAdjustments: true,
            isFollowing: true,
        })
    ).toBe('auto');
    expect(
        getChatVirtualizerScrollBehavior({
            hasAdjustments: true,
            isFollowing: false,
        })
    ).toBe('auto');
    expect(
        getChatVirtualizerScrollBehavior({
            hasAdjustments: false,
            isFollowing: true,
        })
    ).toBe('auto');
});

test('virtualized chat respects explicit scroll behavior requests', () => {
    expect(
        getChatVirtualizerScrollBehavior({
            hasAdjustments: true,
            isFollowing: false,
            requestedBehavior: 'smooth',
        })
    ).toBe('smooth');
});

test('virtualized chat corrects small bottom gaps while following', () => {
    expect(
        shouldCorrectVirtualizedTranscriptEndGap({
            distanceFromEnd: 20,
            isFollowing: true,
        })
    ).toBe(true);
    expect(
        shouldCorrectVirtualizedTranscriptEndGap({
            distanceFromEnd: 20,
            isFollowing: false,
        })
    ).toBe(false);
    expect(
        shouldCorrectVirtualizedTranscriptEndGap({
            distanceFromEnd: 0.5,
            isFollowing: true,
        })
    ).toBe(false);
});

test('virtualized chat follows row growth at the tail while following', () => {
    const previous = getTranscriptRowGrowthSnapshot([
        { id: 'day:today', kind: 'dayDivider', label: 'Today' },
        userRenderRow('user-1'),
        presenceRenderRow('agent-1'),
    ]);
    const next = getTranscriptRowGrowthSnapshot([
        { id: 'day:today', kind: 'dayDivider', label: 'Today' },
        userRenderRow('user-1'),
        userRenderRow('user-2'),
        presenceRenderRow('agent-1'),
    ]);

    expect(shouldFollowTailGrowth({ isFollowing: true, next, previous })).toBe(true);
    expect(shouldFollowTailGrowth({ isFollowing: false, next, previous })).toBe(false);
});

test('virtualized chat follows tail entry item growth while following', () => {
    const previous = getTranscriptRowGrowthSnapshot([
        { id: 'day:today', kind: 'dayDivider', label: 'Today' },
        agentRenderRow('turn:run-1', [{ kind: 'row', row: thinkingRow('act_run_1_thinking') }]),
        presenceRenderRow('turn:run-1'),
    ]);
    const next = getTranscriptRowGrowthSnapshot([
        { id: 'day:today', kind: 'dayDivider', label: 'Today' },
        agentRenderRow('turn:run-1', [
            { kind: 'row', row: thinkingRow('act_run_1_thinking') },
            { kind: 'row', row: richResponseRow('act_run_1_rich_response') },
        ]),
        presenceRenderRow('turn:run-1'),
    ]);

    expect(shouldFollowTailGrowth({ isFollowing: true, next, previous })).toBe(true);
    expect(shouldFollowTailGrowth({ isFollowing: false, next, previous })).toBe(false);
});

test('virtualized chat does not follow prepended history growth', () => {
    const previous = getTranscriptRowGrowthSnapshot([userRenderRow('user-3')]);
    const next = getTranscriptRowGrowthSnapshot([userRenderRow('user-1'), userRenderRow('user-3')]);

    expect(shouldFollowTailGrowth({ isFollowing: true, next, previous })).toBe(false);
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

    const presenceRow = rows.find((row) => row.kind === 'presence');

    expect(rows.map((row) => row.kind)).toEqual(['dayDivider', 'presence']);
    expect(getEstimatedTranscriptRowSize(presenceRow)).toBe(32);
});

test('virtualized chat keeps the presence row stable when first visible reply appears', () => {
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

    expect(thinkingRows.map((row) => row.kind)).toEqual(['dayDivider', 'presence']);
    expect(streamingRows.map((row) => row.kind)).toEqual(['dayDivider', 'entry', 'presence']);
    expect(thinkingRows.at(-1)?.id).toBe(streamingRows.at(-1)?.id);
});

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];

function userRenderRow(id: string): TranscriptRenderRow {
    return {
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
        turnStartedAt: null,
    };
}

function presenceRenderRow(id: string): TranscriptRenderRow {
    const entry = {
        actor: null,
        id,
        items: [],
        key: `agent:${id}`,
        kind: 'turn',
        participant: 'agent',
        responseId: null,
        timestamp: null,
    } satisfies Extract<TranscriptRenderRow, { kind: 'presence' }>['entry'];

    return {
        entry,
        id: `presence:${id}`,
        kind: 'presence',
        turnStartedAt: null,
    };
}

function agentRenderRow(id: string, items: TranscriptItem[]): TranscriptRenderRow {
    return {
        entry: {
            actor: { id: 'agent-1', kind: 'agent' },
            id,
            items,
            key: 'agent:agent-1:session-1',
            kind: 'turn',
            participant: 'agent',
            responseId: 'rsp-1',
            timestamp: '2026-05-11T16:00:01.000Z',
        },
        followsRuntimeNotice: false,
        id,
        kind: 'entry',
        turnStartedAt: null,
    };
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

function richResponseRow(id: string): ChatRow {
    return {
        actor: { id: 'agent-1', kind: 'agent' },
        completedAt: '2026-05-11T16:00:02.000Z',
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'rich_response',
        richResponse: {
            component: 'tavern.rich_response',
            fallbackText: 'Sample Trend Comparison',
            id,
            props: {
                spec: {
                    elements: {
                        display: {
                            props: {
                                data: [{ day: 'Jan 1', value: 12 }],
                                series: [{ key: 'value', label: 'Value' }],
                                title: 'Sample Trend Comparison',
                                xKey: 'day',
                            },
                            type: 'LineChart',
                        },
                    },
                    root: 'display',
                    state: {},
                },
            },
            target: 'chat.inline',
            validationError: null,
        },
        responseId: 'rsp-1',
        sessionKey: 'session-1',
        startedAt: '2026-05-11T16:00:02.000Z',
    };
}
