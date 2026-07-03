import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { formatWorkGroupSummary, isActivityItem } from './chat-transcript-activity-utils.ts';
import {
    buildTranscriptEntries,
    type TranscriptRow,
    type TranscriptTurnEntry,
} from './chat-transcript-model.ts';

// The in-flight agent turn as a transcript entry — the same grouping the
// transcript pane uses, so the status row and turn drawer stay consistent
// with it.
export function findActiveTurnEntry(input: {
    activeReply: ChatActiveReply;
    rows: TranscriptRow[];
    showThinkingText?: boolean;
}): TranscriptTurnEntry | null {
    const entries = buildTranscriptEntries({
        activeReply: input.activeReply,
        rows: input.rows,
        showThinkingText: input.showThinkingText ?? false,
    });

    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (
            entry?.kind === 'turn' &&
            entry.participant === 'agent' &&
            entry.items.some((item) => item.kind === 'activeReply' || item.kind === 'activeStatus')
        ) {
            return entry;
        }
    }

    return null;
}

// The most recent agent turn, active or completed — the turn drawer's entry
// source when there is no live reply.
export function findLastAgentTurnEntry(input: {
    activeReply?: ChatActiveReply | null;
    rows: TranscriptRow[];
    showThinkingText?: boolean;
}): TranscriptTurnEntry | null {
    const entries = buildTranscriptEntries({
        activeReply: input.activeReply ?? null,
        rows: input.rows,
        showThinkingText: input.showThinkingText ?? false,
    });

    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (entry?.kind === 'turn' && entry.participant === 'agent') {
            return entry;
        }
    }

    return null;
}

// Cumulative tool-work summary for a turn ("Ran 3 commands, read 5 files"),
// reusing the work-drawer header vocabulary.
export function formatTurnWorkSummary(entry: TranscriptTurnEntry | null) {
    if (!entry) {
        return null;
    }

    const activityItems = entry.items.filter(isActivityItem);

    if (activityItems.length === 0) {
        return null;
    }

    return formatWorkGroupSummary(activityItems);
}
