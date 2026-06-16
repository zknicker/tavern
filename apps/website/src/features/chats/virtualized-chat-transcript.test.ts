import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    buildTranscriptRenderRows,
    getEstimatedTranscriptRowSize,
} from './chat-transcript-row-model.ts';
import {
    getEstimatedTranscriptBottomOffset,
    getEstimatedTranscriptTailVirtualItems,
    getVirtualizedTranscriptTailFollowKey,
    shouldLoadPreviousVirtualizedChatPage,
    transcriptRowUsesActiveReply,
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
    expect(getEstimatedTranscriptTailVirtualItems(rows, 0)).toEqual([]);
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

test('virtualized chat sync-measures only the live active row', () => {
    const activeReply = {
        agentId: 'agent-1',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-05-11T16:00:00.000Z',
        text: 'Streaming reply.',
    };
    const rows = buildTranscriptRenderRows(
        buildTranscriptEntries({
            activeReply,
            rows: [],
        }),
        1
    );
    const activeEntryIndex = rows.findIndex(
        (row) =>
            row.kind === 'entry' &&
            row.entry.kind === 'turn' &&
            row.entry.items.some((item) => item.kind === 'activeReply')
    );
    const presenceIndex = rows.findIndex((row) => row.kind === 'presence');

    expect(transcriptRowUsesActiveReply(rows[0], activeReply)).toBe(false);
    expect(transcriptRowUsesActiveReply(rows[activeEntryIndex], activeReply)).toBe(true);
    expect(transcriptRowUsesActiveReply(rows[presenceIndex], activeReply)).toBe(false);
    expect(transcriptRowUsesActiveReply(rows[activeEntryIndex], null)).toBe(false);
});

test('virtualized chat reruns tail follow when the active reply settles', () => {
    const activeReply = {
        agentId: 'agent-1',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-05-11T16:00:00.000Z',
        text: 'Streaming reply.',
    };
    const completedReply = {
        ...activeReply,
        completedAt: '2026-05-11T16:00:03.000Z',
    };
    const rows = buildTranscriptRenderRows(
        buildTranscriptEntries({
            activeReply,
            rows: [],
        }),
        0
    );

    expect(getVirtualizedTranscriptTailFollowKey(rows, activeReply)).not.toBe(
        getVirtualizedTranscriptTailFollowKey(rows, completedReply)
    );
    expect(getVirtualizedTranscriptTailFollowKey(rows, completedReply)).not.toBe(
        getVirtualizedTranscriptTailFollowKey(rows, null)
    );
});

test('virtualized chat reruns tail follow when first visible reply appears above presence', () => {
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
    expect(getVirtualizedTranscriptTailFollowKey(thinkingRows, thinkingReply)).not.toBe(
        getVirtualizedTranscriptTailFollowKey(streamingRows, streamingReply)
    );
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
