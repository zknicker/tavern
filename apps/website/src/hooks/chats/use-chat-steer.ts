import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../lib/trpc.tsx';
import {
    type ChatLogSteerNoticeSnapshot,
    patchChatLogWithSteerNotice,
    readChatLogSteerNotice,
    rollbackChatLogSteerNotice,
} from './chat-log-cache.ts';
import { patchLiveChatLogQueries } from './chat-log-query-patch.ts';
import { createChatSteerMutationHandlers } from './chat-steer-mutation.ts';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatSteer() {
    const queryClient = useQueryClient();
    const timeline = useTimelineActions();
    const utils = trpc.useUtils();

    return trpc.chat.steer.useMutation(
        createChatSteerMutationHandlers({
            chat: utils.chat,
            rollbackSteerNotice: ({ chatId, content, previousNotice, runId }) => {
                patchLiveChatLogQueries(queryClient, chatId, (current) =>
                    rollbackChatLogSteerNotice(current, {
                        content,
                        previousNotice: previousNotice.liveLog,
                        runId,
                    })
                );
                timeline.rollbackSteerNotice({
                    chatId,
                    content,
                    previousNotice: previousNotice.timeline,
                    runId,
                });
            },
            session: utils.session,
            showSteerNotice: ({ chatId, content, runId, timestamp }) => {
                let liveLogPreviousNotice: ChatLogSteerNoticeSnapshot | null = null;
                patchLiveChatLogQueries(queryClient, chatId, (current) => {
                    liveLogPreviousNotice ??= readChatLogSteerNotice(current, { runId });
                    return patchChatLogWithSteerNotice(current, {
                        content,
                        runId,
                        timestamp,
                    });
                });
                const timelinePreviousNotice = timeline.showSteerNotice({
                    chatId,
                    content,
                    runId,
                    timestamp,
                });

                return {
                    liveLog: liveLogPreviousNotice,
                    timeline: timelinePreviousNotice,
                };
            },
        })
    );
}
