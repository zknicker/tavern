import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    type ChatLogSteerNoticeSnapshot,
    patchChatLogWithSteerNotice,
    readChatLogSteerNotice,
    rollbackChatLogSteerNotice,
} from './chat-log-cache.ts';
import type { ChatTimelineState } from './chat-timeline-types.ts';

export function readTimelineSteerNotice(
    state: ChatTimelineState,
    input: { runId: string }
): ChatLogSteerNoticeSnapshot | null {
    return readChatLogSteerNotice(timelineLog(state), input);
}

export function patchTimelineWithSteerNotice(
    state: ChatTimelineState,
    input: {
        content: string;
        runId: string;
        timestamp: string;
    }
): ChatTimelineState {
    const patched = patchChatLogWithSteerNotice(timelineLog(state), input);

    return patched ? { ...state, timeline: patched.rows } : state;
}

export function rollbackTimelineSteerNotice(
    state: ChatTimelineState,
    input: {
        content: string;
        previousNotice: ChatLogSteerNoticeSnapshot | null;
        runId: string;
    }
): ChatTimelineState {
    const patched = rollbackChatLogSteerNotice(timelineLog(state), input);

    return patched ? { ...state, timeline: patched.rows } : state;
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
