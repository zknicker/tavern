import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';
import {
    type ActiveReplyMergeOptions,
    hasAssistantReplyForActiveTurn,
    hasTerminalReplyOrFailure,
    isSameActiveReply,
    isSameActiveReplyRun,
    mergeActiveReplySnapshot,
    normalizeActiveReply,
} from './chat-timeline-reply.ts';
import type {
    ChatActiveReply,
    ChatTimeline,
    ChatTimelineState,
    ChatTurnFailure,
} from './chat-timeline-types.ts';

type ChatLogPage = NonNullable<ChatLogOutput>;
type ChatLogInput = Omit<ChatLogPage, 'activeReply' | 'failedTurn'> &
    Partial<Pick<ChatLogPage, 'activeReply' | 'failedTurn'>>;

export function emptyTimelineState(): ChatTimelineState {
    return {
        activeReply: null,
        activeTurn: null,
        failedTurn: null,
        historyLoaded: false,
        timeline: [],
        totalMessages: 0,
    };
}

export function applyLogSnapshot(
    state: ChatTimelineState,
    log: ChatLogInput | undefined
): ChatTimelineState {
    if (!log) {
        return state;
    }

    const snapshot = normalizeChatLog(log);
    const hasTerminalMessage =
        hasTerminalReplyOrFailure({
            activeReply: state.activeReply,
            rows: snapshot.rows,
        }) || snapshot.failedTurn !== null;
    const nextActiveReply = hasTerminalMessage ? null : state.activeReply;
    const nextActiveTurn = hasTerminalMessage ? null : state.activeTurn;
    const nextFailedTurn =
        snapshot.failedTurn ??
        (hasFailureMessage(snapshot.rows, state.failedTurn) ? null : state.failedTurn);
    const historyLoaded = true;
    // The loaded transcript only grows while the chat stays open. The tail
    // page refetches from the newest message, so new durable turns slide the
    // fetched window past rows the user may be reading; retained history
    // keeps them until the chat unmounts.
    const loggedRows = retainLoadedHistory({
        hasOlderHistory: snapshot.nextBeforeSequence !== null,
        liveRunIds: [state.activeReply?.runId, state.activeTurn?.runId],
        logged: snapshot.rows,
        previous: state.timeline,
    });
    const nextTimeline = hasTerminalMessage
        ? loggedRows
        : mergeActiveProgressRows({
              liveRows: state.timeline,
              loggedRows,
              runId: state.activeReply?.runId,
          });
    const nextTotal = snapshot.totalMessages;

    if (
        areSameTimeline(state.timeline, nextTimeline) &&
        state.totalMessages === nextTotal &&
        state.historyLoaded === historyLoaded &&
        isSameActiveReply(state.activeReply, nextActiveReply) &&
        state.activeTurn === nextActiveTurn &&
        isSameTurnFailure(state.failedTurn, nextFailedTurn)
    ) {
        return state;
    }

    return {
        activeReply: nextActiveReply,
        activeTurn: nextActiveTurn,
        failedTurn: nextFailedTurn,
        historyLoaded,
        timeline: nextTimeline,
        totalMessages: nextTotal,
    };
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReply: log.activeReply ?? null,
        failedTurn: log.failedTurn ?? null,
        limit: log.limit,
        nextBeforeSequence: log.nextBeforeSequence,
        rows: log.rows,
        totalMessages: log.totalMessages,
    };
}

export function applyReplySnapshot(
    state: ChatTimelineState,
    activeReply: ChatActiveReply | null,
    options: ActiveReplyMergeOptions = {}
): ChatTimelineState {
    const normalizedActiveReply = mergeActiveReplySnapshot(
        state.activeReply,
        normalizeActiveReply(activeReply),
        options
    );
    const nextActiveReply = (() => {
        if (hasAssistantReplyForActiveTurn(state.timeline, normalizedActiveReply)) {
            return null;
        }

        if (normalizedActiveReply !== null) {
            if (
                state.failedTurn?.turn.runId === normalizedActiveReply.runId ||
                hasLoggedTurnFailure(state.timeline, normalizedActiveReply.runId)
            ) {
                return null;
            }

            return normalizedActiveReply;
        }

        if (state.failedTurn?.turn.runId === state.activeReply?.runId) {
            return null;
        }

        return hasAssistantReplyForActiveTurn(state.timeline, state.activeReply) ||
            Boolean(
                state.activeReply && hasLoggedTurnFailure(state.timeline, state.activeReply.runId)
            ) ||
            state.failedTurn?.turn.runId === state.activeReply?.runId
            ? null
            : state.activeReply;
    })();

    if (isSameActiveReply(state.activeReply, nextActiveReply)) {
        return state;
    }

    return {
        ...state,
        activeReply: nextActiveReply,
        activeTurn:
            nextActiveReply || state.activeTurn?.runId !== state.activeReply?.runId
                ? state.activeTurn
                : null,
        failedTurn:
            nextActiveReply && isSameActiveReplyRun(state.activeReply, nextActiveReply)
                ? state.failedTurn
                : null,
    };
}

export function isSameTurnFailure(left: ChatTurnFailure | null, right: ChatTurnFailure | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.error === right.error &&
        left.turn.runId === right.turn.runId &&
        left.responseId === right.responseId
    );
}

function areSameTimeline(left: ChatTimeline, right: ChatTimeline) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((row, index) => row.id === right[index]?.id);
}

function hasFailureMessage(rows: ChatTimeline, failure: ChatTurnFailure | null) {
    return failure ? hasLoggedTurnFailure(rows, failure.turn.runId) : false;
}

// Rows we already showed stay loaded when the fetched window no longer
// covers the full log: a slid window can drop any loaded row, not just the
// timestamp-oldest. A full-coverage window is authoritative — a row missing
// there was deleted. The live run's own progress rows are placeholders until
// the log confirms them, so they never qualify as retained history.
function retainLoadedHistory(input: {
    hasOlderHistory: boolean;
    liveRunIds: (string | undefined)[];
    logged: ChatTimeline;
    previous: ChatTimeline;
}): ChatTimeline {
    if (!input.hasOlderHistory || input.previous.length === 0 || input.logged.length === 0) {
        return input.logged;
    }

    const loggedIds = new Set<string>();

    for (const row of input.logged) {
        loggedIds.add(row.id);

        if (row.kind === 'message') {
            loggedIds.add(row.message.id);
        }
    }

    const retainedRows = input.previous.filter(
        (row) =>
            !(
                loggedIds.has(row.id) ||
                (row.kind === 'message' && loggedIds.has(row.message.id)) ||
                isLiveRunActivityRowId(row.id, input.liveRunIds)
            )
    );

    return retainedRows.length === 0
        ? input.logged
        : [...retainedRows, ...input.logged].sort(compareTimelineRows);
}

function isLiveRunActivityRowId(rowId: string, runIds: (string | undefined)[]) {
    return runIds.some(
        (runId) => runId && (rowId.startsWith(`act_${runId}_`) || rowId.startsWith(`act_${runId}-`))
    );
}

function mergeActiveProgressRows(input: {
    liveRows: ChatTimeline;
    loggedRows: ChatTimeline;
    runId?: string;
}) {
    const loggedIds = new Set(input.loggedRows.map((row) => row.id));
    const missingLiveRows = input.liveRows.filter(
        (row) => isLiveProgressRow(row, input.runId) && !loggedIds.has(row.id)
    );

    if (missingLiveRows.length === 0) {
        return input.loggedRows;
    }

    return [...input.loggedRows, ...missingLiveRows].sort(compareTimelineRows);
}

function isLiveProgressRow(row: ChatTimeline[number], runId?: string) {
    if (row.kind !== 'tool' || !row.id.startsWith('act_')) {
        return false;
    }

    return !runId || row.id.startsWith(`act_${runId}_`) || runId.startsWith('pending:');
}

function compareTimelineRows(left: ChatTimeline[number], right: ChatTimeline[number]) {
    const timestampDelta = rowTimestamp(left) - rowTimestamp(right);

    return timestampDelta || rowSortRank(left) - rowSortRank(right);
}

function rowTimestamp(row: ChatTimeline[number]) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'tool'
              ? (row.startedAt ?? row.completedAt)
              : row.kind === 'worker'
                ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt)
                : row.timestamp;
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function rowSortRank(row: ChatTimeline[number]) {
    if (row.kind === 'message') {
        if (row.id.startsWith('act_')) {
            return 1;
        }
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}
