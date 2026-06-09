import { trpc } from '../../lib/trpc.tsx';

export function useSaveOpenRouterSettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.openRouterSettings.save.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.openRouterSettings.get.invalidate(),
                utils.usage.live.invalidate(),
            ]);
            await options?.onSuccess?.();
        },
    });
}
