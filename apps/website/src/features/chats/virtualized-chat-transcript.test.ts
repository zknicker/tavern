import { expect, test } from 'bun:test';
import { buildTranscriptEntries } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import { buildTranscriptRenderRows } from './chat-transcript-row-model.ts';
import {
    getEstimatedTranscriptBottomOffset,
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

    expect(getEstimatedTranscriptBottomOffset(rows, 120)).toBe(180);
    expect(getEstimatedTranscriptBottomOffset(rows, 400)).toBe(0);
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

    expect(transcriptRowUsesActiveReply(rows[0], activeReply)).toBe(false);
    expect(transcriptRowUsesActiveReply(rows[1], activeReply)).toBe(true);
    expect(transcriptRowUsesActiveReply(rows[1], null)).toBe(false);
});
