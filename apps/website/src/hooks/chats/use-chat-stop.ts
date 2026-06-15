import { trpc } from '../../lib/trpc.tsx';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatStop() {
    const utils = trpc.useUtils();
    const { optimisticallyStopTurn, removeOptimisticStop } = useTimelineActions();

    return trpc.chat.stop.useMutation({
        onError: (_error, input) => {
            removeOptimisticStop({
                chatId: input.chatId,
                runId: input.runId,
            });
        },
        onMutate: (input) => {
            optimisticallyStopTurn({
                chatId: input.chatId,
                runId: input.runId,
            });
        },
        onSuccess: async (_result, input) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    });
}
