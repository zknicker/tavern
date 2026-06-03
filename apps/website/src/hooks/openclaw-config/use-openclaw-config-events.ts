import { trpc } from '../../lib/trpc.tsx';

export function useOpenClawConfigEvents() {
    const utils = trpc.useUtils();

    trpc.openClawConfig.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.openClawConfig.get.invalidate();
        },
    });
}
