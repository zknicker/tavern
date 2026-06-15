import type { ChatTimeline, ChatTurn } from './chat-timeline-types.ts';

type TurnStatusRow = Extract<ChatTimeline[number], { kind: 'system'; systemKind: 'turnStatus' }>;

export function optimisticStopRowId(runId: string) {
    return `optimistic-stop:${runId}`;
}

export function createOptimisticStopRow(input: {
    timestamp: string;
    turn: ChatTurn;
}): TurnStatusRow {
    return {
        id: optimisticStopRowId(input.turn.runId),
        kind: 'system',
        responseId: optimisticStopRowId(input.turn.runId),
        systemKind: 'turnStatus',
        timestamp: input.timestamp,
        turnStatus: {
            agentId: input.turn.agentId,
            runId: input.turn.runId,
            sessionKey: input.turn.sessionKey,
            status: 'stopped',
            text: 'Agent response stopped.',
        },
    };
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
