import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { defaultLiveChatLogLimit } from './chat-log-cache.ts';
import { createChatTurnEventHandlers } from './chat-turn-events.ts';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatTurnEvents() {
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();
    const { clearTurn, completeTurn, failTurn, patchProgress, startTurn, updateReply } =
        useTimelineActions();
    const handlers = createChatTurnEventHandlers({
        agent: utils.agent,
        chat: {
            get: utils.chat.get,
            list: utils.chat.list,
            log: {
                list: {
                    invalidate: utils.chat.log.list.invalidate,
                    patchProgress: ({ chatId, updater }) => {
                        let matchedQuery = false;

                        queryClient.setQueriesData<ChatLogOutput>(
                            {
                                exact: false,
                                predicate: (query) => isLiveChatLogQuery(query.queryKey, chatId),
                                queryKey: getQueryKey(trpc.chat.log.list, undefined, 'query'),
                            },
                            (current) => {
                                matchedQuery = true;
                                return updater(current);
                            }
                        );

                        if (matchedQuery) {
                            return;
                        }

                        queryClient.setQueryData<ChatLogOutput>(
                            getQueryKey(
                                trpc.chat.log.list,
                                { id: chatId, limit: defaultLiveChatLogLimit },
                                'query'
                            ),
                            updater
                        );
                    },
                },
            },
        },
        session: utils.session,
        timeline: {
            clearTurn,
            completeTurn,
            failTurn,
            patchProgress,
            startTurn,
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

function isLiveChatLogQuery(queryKey: readonly unknown[], chatId: string) {
    const input = readChatLogQueryInput(queryKey);

    return input?.id === chatId && input.offset === undefined;
}

function readChatLogQueryInput(queryKey: readonly unknown[]) {
    const metadata = queryKey[1];

    if (!(metadata && typeof metadata === 'object' && 'input' in metadata)) {
        return null;
    }

    const input = metadata.input;

    if (!(input && typeof input === 'object' && 'id' in input)) {
        return null;
    }

    return input as { id?: string; offset?: number };
}
