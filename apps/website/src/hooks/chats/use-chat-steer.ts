import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../lib/trpc.tsx';
import { patchChatLogWithSteerNotice } from './chat-log-cache.ts';
import { patchLiveChatLogQueries } from './chat-log-query-patch.ts';

export function useChatSteer() {
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();

    return trpc.chat.steer.useMutation({
        onSuccess: async (result, input) => {
            if (result.steered) {
                patchLiveChatLogQueries(queryClient, input.chatId, (current) =>
                    patchChatLogWithSteerNotice(current, {
                        content: input.content,
                        runId: input.runId,
                        timestamp: new Date().toISOString(),
                    })
                );
            }

            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate({ id: input.chatId }),
                utils.session.list.invalidate(),
            ]);
        },
    });
}
