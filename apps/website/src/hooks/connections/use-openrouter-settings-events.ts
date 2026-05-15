import { trpc } from '../../lib/trpc.tsx';

export function useOpenRouterSettingsEvents() {
    const utils = trpc.useUtils();

    trpc.openRouterSettings.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.openRouterSettings.get.invalidate();
        },
    });
}
