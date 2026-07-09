import { postMessageIdForRun } from './chat-log-cache.ts';
import { findActiveReply, removeActiveReply, upsertActiveReply } from './chat-timeline-reply.ts';
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
    ChatTurnStatusUpdate,
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
        activeTurns: upsertActiveTurn(state.activeTurns, turn),
        // A new turn by this agent supersedes its failure banner; other
        // agents' failures stay visible.
        failedTurns: state.failedTurns.filter((failure) => failure.turn.agentId !== turn.agentId),
    };
}

export function updateTimelineReply(
    state: ChatTimelineState,
    update: ChatReplyUpdate
): ChatTimelineState {
    if (state.failedTurns.some((failure) => failure.turn.runId === update.turn.runId)) {
        return state;
    }

    const existingReply = findActiveReply(state.activeReplies, update.turn.runId);
    const existingText = existingReply?.text ?? '';
    const nextText = update.replace
        ? update.text
        : resolveLiveReplyText({
              existingText,
              incomingDelta: update.delta,
              incomingText: update.text,
          });
    const nextState = applyReplySnapshot(
        state,
        {
            agentId: update.turn.agentId,
            isThinking: update.isThinking ?? existingReply?.isThinking ?? true,
            runId: update.turn.runId,
            sessionKey: update.turn.sessionKey,
            startedAt: update.turn.startedAt,
            statusSequence: existingReply?.statusSequence ?? null,
            text: nextText,
        },
        { authoritative: true }
    );

    // Streamed text edits the turn's post in place once it exists
    // (specs/chat-timeline.md); until then the live reply overlay carries it.
    const timeline = patchTimelineRowsWithPostText(nextState.timeline, {
        runId: update.turn.runId,
        text: nextText,
    });

    return {
        ...nextState,
        activeTurns: findActiveReply(nextState.activeReplies, update.turn.runId)
            ? upsertActiveTurn(nextState.activeTurns, update.turn)
            : nextState.activeTurns,
        timeline,
    };
}

function patchTimelineRowsWithPostText(
    timeline: ChatTimelineState['timeline'],
    input: { runId: string; text: string }
): ChatTimelineState['timeline'] {
    const id = postMessageIdForRun(input.runId);
    const content = input.text.trim();
    const existing = timeline.find((row) => row.id === id);

    if (!(content && existing && existing.kind === 'message')) {
        return timeline;
    }

    if (existing.message.content === content) {
        return timeline;
    }

    return timeline.map((row) =>
        row.id === id && row.kind === 'message'
            ? { ...row, message: { ...row.message, content } }
            : row
    );
}

function resolveLiveReplyText(input: {
    existingText: string;
    incomingDelta?: string;
    incomingText: string;
}) {
    if (input.incomingDelta) {
        return `${input.existingText}${input.incomingDelta}`;
    }

    if (!input.incomingText) {
        return input.existingText;
    }

    if (
        input.incomingText.length < input.existingText.length &&
        input.existingText.startsWith(input.incomingText)
    ) {
        return input.existingText;
    }

    return input.incomingText;
}

export function clearTimelineTurn(
    state: ChatTimelineState,
    input: {
        runId?: string;
    } = {}
): ChatTimelineState {
    const activeReplies = input.runId
        ? removeActiveReply(state.activeReplies, input.runId)
        : state.activeReplies.length > 0
          ? []
          : state.activeReplies;
    const activeTurns = input.runId
        ? removeActiveTurn(state.activeTurns, input.runId)
        : state.activeTurns.length > 0
          ? []
          : state.activeTurns;

    if (activeReplies === state.activeReplies && activeTurns === state.activeTurns) {
        return state;
    }

    return {
        ...state,
        activeReplies,
        activeTurns,
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
    const turnEvidence = completeRunEvidence(state.turnEvidence, input);
    const activeTurns = removeActiveTurn(state.activeTurns, input.turn.runId);
    const reply = findActiveReply(state.activeReplies, input.turn.runId);

    if (!reply) {
        return activeTurns === state.activeTurns &&
            timeline === state.timeline &&
            turnEvidence === state.turnEvidence
            ? state
            : { ...state, activeTurns, timeline, turnEvidence };
    }

    return {
        ...state,
        activeReplies: upsertActiveReply(state.activeReplies, {
            ...reply,
            completedAt: input.completedAt,
            isThinking: false,
        }),
        activeTurns,
        timeline,
        turnEvidence,
    };
}

// The run's live evidence settles with the turn, so a drawer open at the
// completion beat shows finished steps instead of perpetually running ones.
function completeRunEvidence(
    turnEvidence: ChatTimelineState['turnEvidence'],
    input: { completedAt: string; turn: ChatTurn }
): ChatTimelineState['turnEvidence'] {
    const rows = turnEvidence[input.turn.runId];

    if (!rows) {
        return turnEvidence;
    }

    const completed = completeLiveProgressRows(rows, input);

    return completed === rows ? turnEvidence : { ...turnEvidence, [input.turn.runId]: completed };
}

export function updateTimelineTurnStatus(
    state: ChatTimelineState,
    update: ChatTurnStatusUpdate
): ChatTimelineState {
    if (state.failedTurns.some((failure) => failure.turn.runId === update.turn.runId)) {
        return state;
    }

    const reply = findActiveReply(state.activeReplies, update.turn.runId);

    if (!reply) {
        return findActiveTurn(state.activeTurns, update.turn.runId)
            ? { ...state, activeTurns: upsertActiveTurn(state.activeTurns, update.turn) }
            : state;
    }

    if (reply.statusSequence === update.sequence) {
        return state;
    }

    return {
        ...state,
        activeReplies: upsertActiveReply(state.activeReplies, {
            ...reply,
            statusSequence: update.sequence,
        }),
        activeTurns: upsertActiveTurn(state.activeTurns, update.turn),
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

    const reply = findActiveReply(state.activeReplies, input.runId);
    const activeTurn =
        findActiveTurn(state.activeTurns, input.runId) ??
        (reply
            ? {
                  agentId: reply.agentId,
                  chatId: input.chatId,
                  runId: reply.runId,
                  sessionKey: reply.sessionKey,
                  startedAt: reply.startedAt,
              }
            : null);

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
    const failedTurn = {
        error: input.error,
        responseId: null,
        turn: input.turn,
    };
    const existing = state.failedTurns.find((failure) => failure.turn.runId === input.turn.runId);

    if (
        isSameTurnFailure(existing ?? null, failedTurn) &&
        !findActiveReply(state.activeReplies, input.turn.runId) &&
        !findActiveTurn(state.activeTurns, input.turn.runId)
    ) {
        return state;
    }

    return {
        ...state,
        activeReplies: removeActiveReply(state.activeReplies, input.turn.runId),
        activeTurns: removeActiveTurn(state.activeTurns, input.turn.runId),
        failedTurns: [
            ...state.failedTurns.filter((failure) => failure.turn.runId !== input.turn.runId),
            failedTurn,
        ],
    };
}

// Dismissing a failed turn hides its banner immediately; the durable
// soft-delete keeps it from coming back on the next log refetch.
export function dismissTimelineFailure(
    state: ChatTimelineState,
    input: { responseId: string }
): ChatTimelineState {
    const failedTurns = state.failedTurns.filter(
        (failure) => failure.responseId !== input.responseId
    );

    return failedTurns.length === state.failedTurns.length ? state : { ...state, failedTurns };
}

function findActiveTurn(turns: readonly ChatTurn[], runId: string) {
    return turns.find((turn) => turn.runId === runId) ?? null;
}

function upsertActiveTurn(turns: readonly ChatTurn[], turn: ChatTurn): ChatTurn[] {
    const existing = findActiveTurn(turns, turn.runId);

    if (existing && isSameActiveTurn(existing, turn)) {
        return turns as ChatTurn[];
    }

    return [...turns.filter((entry) => entry.runId !== turn.runId), turn].sort(
        (left, right) =>
            Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
            left.runId.localeCompare(right.runId)
    );
}

function removeActiveTurn(turns: readonly ChatTurn[], runId: string): ChatTurn[] {
    const next = turns.filter((turn) => turn.runId !== runId);

    return next.length === turns.length ? (turns as ChatTurn[]) : next;
}

function isSameActiveTurn(left: ChatTurn, right: ChatTurn) {
    return (
        left.agentId === right.agentId &&
        left.chatId === right.chatId &&
        left.runId === right.runId &&
        left.sessionKey === right.sessionKey &&
        left.startedAt === right.startedAt
    );
}
