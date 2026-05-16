import { trpc } from '../../lib/trpc.tsx';
import { createChatStatusEventHandlers } from './chat-status-events.ts';
import { useTimelineContext } from './use-timeline-context.tsx';

export function useChatStatusEvents() {
    const utils = trpc.useUtils();
    const { clearTurn, completeTurn, failTurn, startTurn, updateReply, updateTurnProgress } =
        useTimelineContext();
    const handlers = createChatStatusEventHandlers({
        agent: utils.agent,
        chat: utils.chat,
        session: utils.session,
        timeline: {
            clearTurn,
            completeTurn,
            failTurn,
            startTurn,
            updateTurnProgress,
            updateReply,
        },
        worker: utils.worker,
    });

    trpc.chat.onTurnStarted.useSubscription(undefined, {
        onData: handlers.onTurnStarted,
    });

    trpc.chat.onTurnCompleted.useSubscription(undefined, {
        onData: handlers.onTurnCompleted,
    });

    trpc.chat.onTurnFailed.useSubscription(undefined, {
        onData: handlers.onTurnFailed,
    });

    trpc.chat.onTurnProgress.useSubscription(undefined, {
        onData: handlers.onTurnProgress,
    });

    trpc.chat.onTurnReplyUpdated.useSubscription(undefined, {
        onData: handlers.onTurnReplyUpdated,
    });
}
