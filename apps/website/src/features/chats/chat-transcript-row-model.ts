import { formatDayLabel } from '../../components/ui/day-divider.tsx';
import type { TranscriptEntry } from './chat-transcript-model.ts';
import { getItemSessionKey, transcriptEntryUsesActiveReply } from './chat-transcript-model.ts';

export type TranscriptRenderRow =
    | { id: 'hidden-count'; kind: 'hiddenCount' }
    | { id: string; kind: 'dayDivider'; label: string }
    | {
          entry: TranscriptEntry;
          followsRuntimeNotice: boolean;
          id: string;
          kind: 'entry';
          turnStartedAt: string | null;
      }
    | {
          entry: Extract<TranscriptEntry, { kind: 'turn' }>;
          id: string;
          kind: 'presence';
          turnStartedAt: string | null;
      };

export function buildTranscriptRenderRows(entries: TranscriptEntry[], hiddenCount: number) {
    const rows: TranscriptRenderRow[] = [];
    const latestAgentEntryId = getLatestAgentEntryId(entries);

    if (hiddenCount > 0) {
        rows.push({ id: 'hidden-count', kind: 'hiddenCount' });
    }

    let previousDayKey: string | null = null;

    entries.forEach((entry, index) => {
        const previousEntry = index > 0 ? entries[index - 1] : null;
        const timestamp = entry.timestamp;
        const dayKey = getDayKey(timestamp);
        const showDayDivider = dayKey !== null && dayKey !== previousDayKey;
        const turnStartedAt = getAgentTurnStartedAt(previousEntry, entry);

        if (showDayDivider && timestamp) {
            rows.push({
                id: `day:${dayKey}`,
                kind: 'dayDivider',
                label: formatDayLabel(timestamp),
            });
        }

        if (shouldRenderTranscriptEntry(entry)) {
            rows.push({
                entry,
                followsRuntimeNotice: isRuntimeNoticeEntry(previousEntry),
                id: entry.id,
                kind: 'entry',
                turnStartedAt,
            });
        }

        if (
            entry.kind === 'turn' &&
            entry.participant === 'agent' &&
            entry.id === latestAgentEntryId
        ) {
            rows.push({
                entry,
                id: `presence:${entry.id}`,
                kind: 'presence',
                turnStartedAt,
            });
        }

        if (dayKey !== null) {
            previousDayKey = dayKey;
        }
    });

    return rows;
}

function getLatestAgentEntryId(entries: TranscriptEntry[]) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (entry?.kind === 'turn' && entry.participant === 'agent') {
            return entry.id;
        }
    }

    return null;
}

export function getEstimatedTranscriptRowSize(row: TranscriptRenderRow | undefined) {
    if (!row || row.kind === 'hiddenCount') {
        return 32;
    }

    if (row.kind === 'dayDivider') {
        return 36;
    }

    if (row.kind === 'presence') {
        return 44;
    }

    if (row.entry.kind === 'system') {
        return 48;
    }

    if (row.entry.participant === 'user') {
        return 88;
    }

    if (isActiveStatusOnlyAgentEntry(row.entry)) {
        return 56;
    }

    return 180;
}

export function transcriptRenderRowUsesActiveReply(
    row: TranscriptRenderRow | undefined,
    activeReply: Parameters<typeof transcriptEntryUsesActiveReply>[1]
) {
    if (!row || row.kind === 'hiddenCount' || row.kind === 'dayDivider') {
        return false;
    }

    return transcriptEntryUsesActiveReply(row.entry, activeReply);
}

function shouldRenderTranscriptEntry(entry: TranscriptEntry) {
    if (entry.kind !== 'turn' || entry.participant !== 'agent') {
        return true;
    }

    return entry.items.some((item) => item.kind !== 'activeStatus');
}

function isActiveStatusOnlyAgentEntry(entry: TranscriptEntry) {
    return (
        entry.kind === 'turn' &&
        entry.participant === 'agent' &&
        entry.items.length === 1 &&
        entry.items[0]?.kind === 'activeStatus'
    );
}

function isRuntimeNoticeEntry(entry: TranscriptEntry | null) {
    return (
        entry?.kind === 'system' &&
        entry.item.kind === 'row' &&
        entry.item.row.kind === 'system' &&
        entry.item.row.systemKind === 'runtimeNotice'
    );
}

function getDayKey(timestamp: string | null) {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getAgentTurnStartedAt(
    previousEntry: TranscriptEntry | null,
    entry: TranscriptEntry
): string | null {
    if (
        entry.kind !== 'turn' ||
        entry.participant !== 'agent' ||
        previousEntry?.kind !== 'turn' ||
        previousEntry.participant !== 'user'
    ) {
        return null;
    }

    const agentSessionKey = getEntrySessionKey(entry);
    const userSessionKey = getEntrySessionKey(previousEntry);

    return agentSessionKey && agentSessionKey === userSessionKey ? previousEntry.timestamp : null;
}

function getEntrySessionKey(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    for (const item of entry.items) {
        const sessionKey = getItemSessionKey(item);

        if (sessionKey) {
            return sessionKey;
        }
    }

    return null;
}
