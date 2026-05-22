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

export function emptyTimelineState(): ChatTimelineState {
    return {
        activeReply: null,
        failedTurn: null,
        historyLoaded: false,
        timeline: [],
        totalRows: 0,
    };
}

export function applyLogSnapshot(
    state: ChatTimelineState,
    log: ChatLogOutput | undefined
): ChatTimelineState {
    if (!log) {
        return state;
    }

    const hasTerminalMessage = hasTerminalReplyOrFailure({
        activeReply: state.activeReply,
        rows: log.rows,
    });
    const nextActiveReply = hasTerminalMessage ? null : state.activeReply;
    const nextFailedTurn = hasFailureMessage(log.rows, state.failedTurn) ? null : state.failedTurn;
    const historyLoaded = true;

    if (
        areSameTimeline(state.timeline, log.rows) &&
        state.totalRows === log.total &&
        state.historyLoaded === historyLoaded &&
        isSameActiveReply(state.activeReply, nextActiveReply) &&
        isSameTurnFailure(state.failedTurn, nextFailedTurn)
    ) {
        return state;
    }

    return {
        activeReply: nextActiveReply,
        failedTurn: nextFailedTurn,
        historyLoaded,
        timeline: log.rows,
        totalRows: log.total,
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
