import { trpc } from '../../lib/trpc.tsx';

export function useHermesConfigEvents() {
    const utils = trpc.useUtils();

    trpc.hermesConfig.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.hermesConfig.get.invalidate();
        },
    });
}
