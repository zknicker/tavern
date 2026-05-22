import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import { hasDurableActivityForTurn } from './chat-timeline-activity.ts';
import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';
import {
    areSameProgressSteps,
    completeProgressSteps,
    mergeProgressSteps,
} from './chat-timeline-progress.ts';
import {
    getTerminalAssistantReplyTimestamp,
    hasAssistantReplyForActiveTurn,
    hasTerminalReplyOrFailure,
    isSameActiveReply,
    isSameActiveReplyRun,
    mergeActiveReplySnapshot,
    normalizeActiveReply,
} from './chat-timeline-reply.ts';
import type {
    ChatActiveReply,
    ChatActiveStatus,
    ChatCompletedProgress,
    ChatTimeline,
    ChatTimelineState,
    ChatTurnFailure,
} from './chat-timeline-types.ts';

export function emptyTimelineState(): ChatTimelineState {
    return {
        activeReply: null,
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
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
    const completedAt =
        state.activeReply && hasTerminalMessage
            ? getTerminalAssistantReplyTimestamp(log.rows, state.activeReply)
            : null;
    const nextActiveReply = hasTerminalMessage ? null : state.activeReply;
    const nextCompletedProgress = resolveCompletedProgress({
        completedAt,
        logRows: log.rows,
        nextActiveReply,
        state,
    });
    const nextFailedTurn = hasFailureMessage(log.rows, state.failedTurn) ? null : state.failedTurn;
    const historyLoaded = true;

    if (
        areSameTimeline(state.timeline, log.rows) &&
        state.totalRows === log.total &&
        state.historyLoaded === historyLoaded &&
        isSameActiveReply(state.activeReply, nextActiveReply) &&
        isSameCompletedProgress(state.completedProgress, nextCompletedProgress) &&
        isSameTurnFailure(state.failedTurn, nextFailedTurn)
    ) {
        return state;
    }

    return {
        activeReply: nextActiveReply,
        activeReplyProgressStartedAt: nextActiveReply ? state.activeReplyProgressStartedAt : null,
        activeReplySteps: nextActiveReply ? state.activeReplySteps : [],
        completedProgress: nextCompletedProgress,
        failedTurn: nextFailedTurn,
        historyLoaded,
        timeline: log.rows,
        totalRows: log.total,
    };
}

export function applyReplySnapshot(
    state: ChatTimelineState,
    activeReply: ChatStatusListOutput['chats'][number]['activeReply'] | null
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
            if (state.completedProgress?.reply.runId === normalizedActiveReply.runId) {
                return null;
            }

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
    const keepsSameRun = isSameActiveReplyRun(state.activeReply, nextActiveReply);

    if (isSameActiveReply(state.activeReply, nextActiveReply)) {
        return state;
    }

    return {
        ...state,
        activeReply: nextActiveReply,
        activeReplyProgressStartedAt: nextActiveReply
            ? keepsSameRun
                ? state.activeReplyProgressStartedAt
                : null
            : null,
        activeReplySteps: nextActiveReply ? (keepsSameRun ? state.activeReplySteps : []) : [],
        completedProgress:
            nextActiveReply && state.completedProgress?.reply.runId !== nextActiveReply.runId
                ? null
                : state.completedProgress,
        failedTurn: nextActiveReply && keepsSameRun ? state.failedTurn : null,
    };
}

export function applyStatusSnapshot(
    state: ChatTimelineState,
    status: ChatActiveStatus | null
): ChatTimelineState {
    const next = applyReplySnapshot(state, status?.activeReply ?? null);
    const steps = status?.activeReplySteps ?? [];

    if (!status?.activeReply || steps.length === 0 || !next.activeReply) {
        return next;
    }

    if (next.activeReply.runId !== status.activeReply.runId) {
        return next;
    }

    const mergedSteps = mergeProgressSteps(next.activeReplySteps, steps);
    const progressStartedAt =
        next.activeReplyProgressStartedAt ??
        status.activeReplyProgressStartedAt ??
        status.activeReply.startedAt;

    if (
        next.activeReplyProgressStartedAt === progressStartedAt &&
        areSameProgressSteps(next.activeReplySteps, mergedSteps)
    ) {
        return next;
    }

    return {
        ...next,
        activeReplyProgressStartedAt: progressStartedAt,
        activeReplySteps: mergedSteps,
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

function resolveCompletedProgress({
    completedAt,
    logRows,
    nextActiveReply,
    state,
}: {
    completedAt: string | null;
    logRows: ChatTimeline;
    nextActiveReply: ChatActiveReply | null;
    state: ChatTimelineState;
}): ChatCompletedProgress | null {
    if (nextActiveReply) {
        return null;
    }

    if (
        state.activeReply &&
        state.activeReplySteps.length > 0 &&
        completedAt &&
        !hasDurableActivityForTurn(logRows, {
            sessionKey: state.activeReply.sessionKey,
            startedAt: state.activeReply.startedAt,
        })
    ) {
        return {
            completedAt,
            reply: state.activeReply,
            startedAt: state.activeReplyProgressStartedAt ?? state.activeReply.startedAt,
            steps: completeProgressSteps(state.activeReplySteps),
        };
    }

    if (!state.completedProgress) {
        return null;
    }

    return hasDurableActivityForTurn(logRows, {
        sessionKey: state.completedProgress.reply.sessionKey,
        startedAt: state.completedProgress.reply.startedAt,
    })
        ? null
        : state.completedProgress;
}

function isSameCompletedProgress(
    left: ChatCompletedProgress | null,
    right: ChatCompletedProgress | null
) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.completedAt === right.completedAt &&
        left.reply.runId === right.reply.runId &&
        left.startedAt === right.startedAt &&
        left.steps.length === right.steps.length &&
        left.steps.every((step, index) => step.id === right.steps[index]?.id)
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
