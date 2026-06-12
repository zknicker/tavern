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
        activeTurn: input.turn,
        timeline: patched.rows,
    };
}

function timelineLog(state: ChatTimelineState): ChatLogOutput {
    return {
        activeReply: state.activeReply
            ? {
                  ...state.activeReply,
                  isThinking: state.activeReply.isThinking ?? true,
                  text: state.activeReply.text ?? '',
              }
            : null,
        failedTurn: state.failedTurn,
        limit: Math.max(state.timeline.length + 1, 100),
        nextBeforeSequence: null,
        rows: state.timeline,
        totalMessages: state.totalMessages,
    };
}
