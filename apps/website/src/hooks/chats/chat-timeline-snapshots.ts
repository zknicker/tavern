import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';
import {
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
        totalRows: 0,
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
    const nextTimeline = hasTerminalMessage
        ? snapshot.rows
        : mergeActiveProgressRows({
              liveRows: state.timeline,
              loggedRows: snapshot.rows,
              runId: state.activeReply?.runId,
          });
    const nextTotal = snapshot.total + Math.max(0, nextTimeline.length - snapshot.rows.length);

    if (
        areSameTimeline(state.timeline, nextTimeline) &&
        state.totalRows === nextTotal &&
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
        totalRows: nextTotal,
    };
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReply: log.activeReply ?? null,
        failedTurn: log.failedTurn ?? null,
        limit: log.limit,
        offset: log.offset,
        rows: log.rows,
        total: log.total,
    };
}

export function applyReplySnapshot(
    state: ChatTimelineState,
    activeReply: ChatActiveReply | null
): ChatTimelineState {
    const normalizedActiveReply = mergeActiveReplySnapshot(
        state.activeReply,
        normalizeActiveReply(activeReply)
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

    return left.error === right.error && left.turn.runId === right.turn.runId;
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
