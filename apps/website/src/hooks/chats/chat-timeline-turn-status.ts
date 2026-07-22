import type { ChatTimeline } from './chat-timeline-types.ts';

type TurnStatusRow = Extract<ChatTimeline[number], { kind: 'system'; systemKind: 'turnStatus' }>;

// Client-side optimistic stop rows are never created anymore (the turn state
// that would seed one — activeTurns/activeReplies — can never populate now
// that chat.onTurn* events are gone); durable rows remain the only source of
// a 'turnStatus' row, so this only ever matches server data.
function optimisticStopRowId(runId: string) {
    return `optimistic-stop:${runId}`;
}

export function isTurnStatusRow(row: ChatTimeline[number]): row is TurnStatusRow {
    return row.kind === 'system' && row.systemKind === 'turnStatus';
}

export function isOptimisticStopRow(row: ChatTimeline[number]): row is TurnStatusRow {
    return isTurnStatusRow(row) && row.id === optimisticStopRowId(row.turnStatus.runId);
}

export function hasTurnStatusRow(rows: ChatTimeline, runId: string | null | undefined) {
    return Boolean(
        runId && rows.some((row) => isTurnStatusRow(row) && row.turnStatus.runId === runId)
    );
}
