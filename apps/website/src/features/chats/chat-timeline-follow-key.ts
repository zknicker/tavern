import type {
    ChatActiveReply,
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';

export function getChatTimelineFollowKey(input: {
    activeReply: ChatActiveReply | null;
    activeReplySteps: ChatTurnProgressStep[];
    failedTurn?: ChatTurnFailure | null;
}) {
    if (input.activeReply) {
        const replyText = input.activeReply.text?.trim() ?? '';
        const phase =
            replyText.length > 0
                ? 'reply'
                : input.activeReplySteps.length > 0
                  ? 'working'
                  : 'thinking';

        return `${input.activeReply.runId}:${phase}`;
    }

    if (input.failedTurn) {
        return `${input.failedTurn.turn.runId}:failed`;
    }

    return null;
}
