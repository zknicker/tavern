import { trpc } from '../../lib/trpc.tsx';

export function useTaskEvents() {
    const utils = trpc.useUtils();
    trpc.task.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.task.list.invalidate();
            void utils.chat.log.list.invalidate();
        },
    });
}
