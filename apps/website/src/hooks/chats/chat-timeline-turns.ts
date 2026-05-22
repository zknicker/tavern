import { completeProgressSteps } from './chat-timeline-progress.ts';
import { normalizeActiveReply } from './chat-timeline-reply.ts';
import { applyReplySnapshot, isSameTurnFailure } from './chat-timeline-snapshots.ts';
import {
    type ChatReplyUpdate,
    type ChatTimelineState,
    type ChatTurn,
    type ChatTurnProgressStep,
    initialPlanningStep,
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
        activeReplyProgressStartedAt: null,
        activeReplySteps: [initialPlanningStep],
        completedProgress: null,
        failedTurn: null,
    };
}

export function updateTimelineTurnProgress(
    state: ChatTimelineState,
    input: {
        receivedAt?: string;
        step: ChatTurnProgressStep;
        turn: ChatTurn;
    }
): ChatTimelineState {
    const stateForTurn =
        state.activeReply?.runId === input.turn.runId
            ? state
            : adoptHydratedReplyTurn(state, input.turn);

    if (!stateForTurn.activeReply || stateForTurn.activeReply.runId !== input.turn.runId) {
        return state;
    }

    const currentSteps =
        input.step.id === initialPlanningStep.id
            ? stateForTurn.activeReplySteps
            : stateForTurn.activeReplySteps.filter((step) => step.id !== initialPlanningStep.id);
    const existingIndex = currentSteps.findIndex((step) => step.id === input.step.id);
    const nextSteps =
        existingIndex >= 0
            ? currentSteps.map((step, index) => (index === existingIndex ? input.step : step))
            : [...currentSteps, input.step];

    return {
        ...stateForTurn,
        activeReplyProgressStartedAt:
            stateForTurn.activeReplyProgressStartedAt ?? input.receivedAt ?? input.turn.startedAt,
        activeReplySteps: nextSteps,
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

    const nextState = applyReplySnapshot(state, nextReply);

    if (
        update.replace === true &&
        update.isThinking === false &&
        state.activeReply?.runId === update.turn.runId &&
        state.activeReplySteps.length > 0 &&
        !nextState.completedProgress
    ) {
        return completeTimelineTurn(nextState, {
            completedAt: new Date().toISOString(),
            turn: update.turn,
        });
    }

    return nextState;
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
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
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
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress:
            state.activeReplySteps.length > 0
                ? {
                      completedAt: input.completedAt,
                      reply: state.activeReply,
                      startedAt: state.activeReplyProgressStartedAt ?? state.activeReply.startedAt,
                      steps: completeProgressSteps(state.activeReplySteps),
                  }
                : null,
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

    if (
        !state.activeReply &&
        state.activeReplySteps.length === 0 &&
        isSameTurnFailure(state.failedTurn, failedTurn)
    ) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
        failedTurn,
    };
}

function adoptHydratedReplyTurn(state: ChatTimelineState, turn: ChatTurn): ChatTimelineState {
    const activeReply = state.activeReply;

    if (
        !activeReply ||
        activeReply.sessionKey !== turn.sessionKey ||
        state.activeReplySteps.length > 0 ||
        (activeReply.text ?? '').trim().length > 0
    ) {
        return state;
    }

    return {
        ...state,
        activeReply: {
            ...activeReply,
            agentId: turn.agentId,
            runId: turn.runId,
            startedAt: turn.startedAt,
        },
    };
}
