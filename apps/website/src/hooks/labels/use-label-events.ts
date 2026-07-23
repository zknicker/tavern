import { trpc } from '../../lib/trpc.tsx';

export function useLabelEvents() {
    const utils = trpc.useUtils();
    trpc.label.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.label.list.invalidate();
            void utils.task.list.invalidate();
        },
    });
}
