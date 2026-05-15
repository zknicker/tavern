import { trpc } from '../../lib/trpc.tsx';

export function useUsageEvents() {
    const utils = trpc.useUtils();

    trpc.usage.onLiveUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.usage.live.invalidate();
        },
    });
}
