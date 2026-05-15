import { trpc } from '../../lib/trpc.tsx';

export function useWorkerEvents() {
    const utils = trpc.useUtils();

    trpc.worker.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.worker.list.invalidate();
        },
    });
}
