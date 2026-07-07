import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { patchChatLogWithProgress } from './chat-log-cache.ts';
import type { ChatTimelineState, ChatTurn, ChatTurnProgressStep } from './chat-timeline-types.ts';

export function patchTimelineProgress(
    state: ChatTimelineState,
    input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    const patched = patchChatLogWithProgress(timelineLog(state), input);

    if (!patched) {
        return state;
    }

    return {
        ...state,
        activeTurns: [
            ...state.activeTurns.filter((turn) => turn.runId !== input.turn.runId),
            input.turn,
        ],
        timeline: patched.rows,
    };
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
