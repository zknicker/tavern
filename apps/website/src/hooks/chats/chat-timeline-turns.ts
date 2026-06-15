import { normalizeActiveReply } from './chat-timeline-reply.ts';
import { applyReplySnapshot, isSameTurnFailure } from './chat-timeline-snapshots.ts';
import {
    createOptimisticStopRow,
    hasTurnStatusRow,
    optimisticStopRowId,
} from './chat-timeline-turn-status.ts';
import type {
    ChatReplyUpdate,
    ChatTimeline,
    ChatTimelineState,
    ChatTurn,
} from './chat-timeline-types.ts';

export function startTimelineTurn(state: ChatTimelineState, turn: ChatTurn): ChatTimelineState {
    return {
        ...applyReplySnapshot(state, {
            agentId: turn.agentId,
            isThinking: true,
            runId: turn.runId,
            sessionKey: turn.sessionKey,
            startedAt: turn.startedAt,
            text: '',
        }),
        activeTurn: turn,
        failedTurn: null,
    };
}

export function updateTimelineReply(
    state: ChatTimelineState,
    update: ChatReplyUpdate
): ChatTimelineState {
    if (state.failedTurn?.turn.runId === update.turn.runId) {
        return state;
    }

    const existingReply =
        state.activeReply && state.activeReply.runId === update.turn.runId
            ? state.activeReply
            : null;
    const existingText = existingReply?.text ?? '';
    const nextText = update.replace
        ? update.text
        : update.text || (update.delta ? `${existingText}${update.delta}` : existingText);
    const nextReply = normalizeActiveReply({
        agentId: update.turn.agentId,
        isThinking: update.isThinking ?? existingReply?.isThinking,
        runId: update.turn.runId,
        sessionKey: update.turn.sessionKey,
        startedAt: update.turn.startedAt,
        text: nextText,
    });

    const nextState = applyReplySnapshot(state, nextReply, { authoritative: true });

    return {
        ...nextState,
        activeTurn: nextState.activeReply ? update.turn : nextState.activeTurn,
    };
}

export function clearTimelineTurn(
    state: ChatTimelineState,
    input: {
        runId?: string;
    } = {}
): ChatTimelineState {
    if (!state.activeReply) {
        return state;
    }

    if (input.runId && state.activeReply.runId !== input.runId) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        activeTurn:
            input.runId && state.activeTurn?.runId !== input.runId ? state.activeTurn : null,
    };
}

export function completeTimelineTurn(
    state: ChatTimelineState,
    input: {
        completedAt: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    const timeline = completeLiveProgressRows(state.timeline, input);

    if (!state.activeReply || state.activeReply.runId !== input.turn.runId) {
        return state.activeTurn?.runId === input.turn.runId
            ? {
                  ...state,
                  activeTurn: null,
                  timeline,
              }
            : timeline === state.timeline
              ? state
              : { ...state, timeline };
    }

    return {
        ...state,
        activeReply: {
            ...state.activeReply,
            completedAt: input.completedAt,
            isThinking: false,
        },
        activeTurn: null,
        timeline,
    };
}

function completeLiveProgressRows(
    timeline: ChatTimeline,
    input: {
        completedAt: string;
        turn: ChatTurn;
    }
) {
    let changed = false;
    const rows = timeline.map((row) => {
        if (
            row.kind !== 'tool' ||
            row.completedAt !== null ||
            !isTurnActivityRow(row.id, input.turn.runId)
        ) {
            return row;
        }

        changed = true;
        return {
            ...row,
            completedAt: input.completedAt,
        };
    });

    return changed ? rows : timeline;
}

function isTurnActivityRow(rowId: string, runId: string) {
    return rowId.startsWith(`act_${runId}_`) || rowId.startsWith(`act_${runId}-`);
}

export function optimisticallyStopTimelineTurn(
    state: ChatTimelineState,
    input: {
        chatId: string;
        runId: string;
        stoppedAt: string;
    }
): ChatTimelineState {
    if (hasTurnStatusRow(state.timeline, input.runId)) {
        return state;
    }

    const activeTurn =
        state.activeTurn?.runId === input.runId
            ? state.activeTurn
            : state.activeReply?.runId === input.runId
              ? {
                    agentId: state.activeReply.agentId,
                    chatId: input.chatId,
                    runId: state.activeReply.runId,
                    sessionKey: state.activeReply.sessionKey,
                    startedAt: state.activeReply.startedAt,
                }
              : null;

    if (!activeTurn) {
        return state;
    }

    return {
        ...state,
        timeline: [
            ...state.timeline,
            createOptimisticStopRow({
                timestamp: input.stoppedAt,
                turn: activeTurn,
            }),
        ],
    };
}

export function removeOptimisticStoppedTurn(
    state: ChatTimelineState,
    input: { runId: string }
): ChatTimelineState {
    const optimisticId = optimisticStopRowId(input.runId);
    const timeline = state.timeline.filter((row) => row.id !== optimisticId);

    return timeline.length === state.timeline.length ? state : { ...state, timeline };
}

export function failTimelineTurn(
    state: ChatTimelineState,
    input: {
        error: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    if (state.activeReply && state.activeReply.runId !== input.turn.runId) {
        return state;
    }

    const failedTurn = {
        error: input.error,
        responseId: null,
        turn: input.turn,
    };

    if (!state.activeReply && isSameTurnFailure(state.failedTurn, failedTurn)) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        activeTurn:
            state.activeTurn?.runId === input.turn.runId || !state.activeTurn
                ? null
                : state.activeTurn,
        failedTurn,
    };
}

// Dismissing a failed turn hides its banner immediately; the durable
// soft-delete keeps it from coming back on the next log refetch.
export function dismissTimelineFailure(
    state: ChatTimelineState,
    input: { responseId: string }
): ChatTimelineState {
    if (state.failedTurn?.responseId !== input.responseId) {
        return state;
    }

    return {
        ...state,
        failedTurn: null,
    };
}
