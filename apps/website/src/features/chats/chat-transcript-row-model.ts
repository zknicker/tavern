import { formatDayLabel } from '../../components/ui/day-divider.tsx';
import type { TranscriptEntry } from './chat-transcript-model.ts';
import { getItemSessionKey } from './chat-transcript-model.ts';

export type TranscriptRenderRow =
    | { id: 'hidden-count'; kind: 'hiddenCount' }
    | {
          dayLabel: string | null;
          entry: TranscriptEntry;
          followsRuntimeNotice: boolean;
          id: string;
          kind: 'entry';
          turnStartedAt: string | null;
      };

export function buildTranscriptRenderRows(entries: TranscriptEntry[], hiddenCount: number) {
    const rows: TranscriptRenderRow[] = [];

    if (hiddenCount > 0) {
        rows.push({ id: 'hidden-count', kind: 'hiddenCount' });
    }

    let previousDayKey: string | null = null;

    entries.forEach((entry, index) => {
        const previousEntry = index > 0 ? entries[index - 1] : null;
        const timestamp = entry.timestamp;
        const dayKey = getDayKey(timestamp);
        const showDayDivider = dayKey !== null && dayKey !== previousDayKey;

        rows.push({
            dayLabel: showDayDivider && timestamp ? formatDayLabel(timestamp) : null,
            entry,
            followsRuntimeNotice: isRuntimeNoticeEntry(previousEntry),
            id: entry.id,
            kind: 'entry',
            turnStartedAt: getAgentTurnStartedAt(previousEntry, entry),
        });

        if (dayKey !== null) {
            previousDayKey = dayKey;
        }
    });

    return rows;
}

export function getEstimatedTranscriptRowSize(row: TranscriptRenderRow | undefined) {
    if (!row || row.kind === 'hiddenCount') {
        return 32;
    }

    if (row.entry.kind === 'system') {
        return 48;
    }

    return row.entry.participant === 'user' ? 88 : 180;
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
