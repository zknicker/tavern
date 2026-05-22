import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';

export function getChatTimelineFollowKey(input: {
    activeReply: ChatActiveReply | null;
    failedTurn?: ChatTurnFailure | null;
}) {
    if (input.activeReply) {
        const replyText = input.activeReply.text?.trim() ?? '';
        const phase = replyText.length > 0 ? 'reply' : 'thinking';

        return `${input.activeReply.runId}:${phase}`;
    }

    if (input.failedTurn) {
        return `${input.failedTurn.turn.runId}:failed`;
    }

    return null;
}
