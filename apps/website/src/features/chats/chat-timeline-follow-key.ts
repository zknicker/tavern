import type {
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatStatusListOutput } from '../../lib/trpc.tsx';

type ActiveReply = ChatStatusListOutput['chats'][number]['activeReply'];

export function getChatTimelineFollowKey(input: {
    activeReply: ActiveReply | null;
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
