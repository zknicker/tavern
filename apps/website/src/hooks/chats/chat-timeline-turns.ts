import { normalizeActiveReply } from './chat-timeline-reply.ts';
import { applyReplySnapshot, isSameTurnFailure } from './chat-timeline-snapshots.ts';
import type { ChatReplyUpdate, ChatTimelineState, ChatTurn } from './chat-timeline-types.ts';

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

    const existingText =
        state.activeReply && state.activeReply.runId === update.turn.runId
            ? (state.activeReply.text ?? '')
            : '';
    const nextText = update.replace
        ? update.text
        : update.text || (update.delta ? `${existingText}${update.delta}` : existingText);
    const nextReply = normalizeActiveReply({
        agentId: update.turn.agentId,
        isThinking: update.isThinking,
        runId: update.turn.runId,
        sessionKey: update.turn.sessionKey,
        startedAt: update.turn.startedAt,
        text: nextText,
    });

    return applyReplySnapshot(state, nextReply);
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
    };
}

export function completeTimelineTurn(
    state: ChatTimelineState,
    input: {
        completedAt: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    if (!state.activeReply || state.activeReply.runId !== input.turn.runId) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
    };
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
        turn: input.turn,
    };

    if (!state.activeReply && isSameTurnFailure(state.failedTurn, failedTurn)) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        failedTurn,
    };
}
