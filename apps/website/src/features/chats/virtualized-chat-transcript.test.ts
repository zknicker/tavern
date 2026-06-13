import { expect, test } from 'bun:test';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    getEstimatedTranscriptBottomOffset,
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
            entry: { kind: 'turn', participant: 'user' },
            id: 'user-row',
            kind: 'entry',
        },
        {
            entry: { kind: 'turn', participant: 'agent' },
            id: 'agent-row',
            kind: 'entry',
        },
    ] as TranscriptRenderRow[];

    expect(getEstimatedTranscriptBottomOffset(rows, 120)).toBe(180);
    expect(getEstimatedTranscriptBottomOffset(rows, 400)).toBe(0);
});
