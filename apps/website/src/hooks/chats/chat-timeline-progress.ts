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
        timeline: patched.rows,
        totalRows: patched.total,
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
        limit: Math.max(state.timeline.length + 1, 100),
        offset: 0,
        rows: state.timeline,
        total: state.totalRows,
    };
}
