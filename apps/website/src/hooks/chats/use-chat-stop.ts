import { trpc } from '../../lib/trpc.tsx';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatStop() {
    const utils = trpc.useUtils();
    const { clearTurn, optimisticallyStopTurn, removeOptimisticStop } = useTimelineActions();

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
        onSuccess: async (result, input) => {
            // stopped=false means the runtime has no live turn under this run
            // id — whatever the app is still showing is phantom state (for
            // example a missed terminal event), so stop doubles as the escape
            // hatch that clears it.
            if (!result.stopped) {
                removeOptimisticStop({
                    chatId: input.chatId,
                    runId: input.runId,
                });
                clearTurn({
                    chatId: input.chatId,
                    runId: input.runId,
                });
            }
            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    });
}
