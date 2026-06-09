import { trpc } from '../../lib/trpc.tsx';

export function useDeleteOpenRouterSettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.openRouterSettings.delete.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.openRouterSettings.get.invalidate(),
                utils.usage.live.invalidate(),
            ]);
            await options?.onSuccess?.();
        },
    });
}
