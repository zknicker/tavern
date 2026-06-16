import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../lib/trpc.tsx';
import { patchLiveChatLogQueries } from './chat-log-query-patch.ts';
import { createChatTurnEventHandlers } from './chat-turn-events.ts';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatTurnEvents() {
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();
    const {
        clearTurn,
        completeTurn,
        failTurn,
        patchProgress,
        startTurn,
        updateReply,
        updateTurnStatus,
    } = useTimelineActions();
    const handlers = createChatTurnEventHandlers({
        agent: utils.agent,
        chat: {
            list: utils.chat.list,
            log: {
                list: {
                    patchProgress: ({ chatId, updater }) =>
                        patchLiveChatLogQueries(queryClient, chatId, updater),
                },
            },
        },
        timeline: {
            clearTurn,
            completeTurn,
            failTurn,
            patchProgress,
            startTurn,
            updateReply,
            updateTurnStatus,
        },
        worker: utils.worker,
    });

    trpc.chat.onTurnStarted.useSubscription(undefined, {
        onData: handlers.onTurnStarted,
    });

    trpc.chat.onTurnCompleted.useSubscription(undefined, {
        onData: handlers.onTurnCompleted,
    });

    trpc.chat.onTurnCancelled.useSubscription(undefined, {
        onData: handlers.onTurnCancelled,
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

    trpc.chat.onTurnStatusUpdated.useSubscription(undefined, {
        onData: handlers.onTurnStatusUpdated,
    });
}
