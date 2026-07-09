import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    patchChatLogWithProgress,
    progressStepToChatRows,
    upsertProgressRows,
} from './chat-log-cache.ts';
import type { ChatTimelineState, ChatTurn, ChatTurnProgressStep } from './chat-timeline-types.ts';

// Progress steps feed two surfaces (specs/chat-timeline.md): every step lands
// in the run's live evidence (the drawer's source while the turn streams),
// while conversation-visible steps — the turn's post, widgets, notices,
// steered messages — touch the timeline.
export function patchTimelineProgress(
    state: ChatTimelineState,
    input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    const runId = input.turn.runId;
    const stepRows = progressStepToChatRows(input);
    const next: ChatTimelineState = {
        ...state,
        activeTurns: [...state.activeTurns.filter((turn) => turn.runId !== runId), input.turn],
        turnEvidence: {
            ...state.turnEvidence,
            [runId]: upsertProgressRows(state.turnEvidence[runId] ?? [], stepRows),
        },
    };

    const patched = patchChatLogWithProgress(timelineLog(next), input);

    return patched ? { ...next, timeline: patched.rows } : next;
}

function timelineLog(state: ChatTimelineState): ChatLogOutput {
    return {
        activeReplies: state.activeReplies.map((reply) => ({
            ...reply,
            isThinking: reply.isThinking ?? true,
            text: reply.text ?? '',
        })),
        failedTurns: state.failedTurns,
        limit: Math.max(state.timeline.length + 1, 100),
        nextBeforeSequence: null,
        rows: state.timeline,
        totalMessages: state.totalMessages,
    };
}
