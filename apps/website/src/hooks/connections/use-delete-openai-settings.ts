import { trpc } from '../../lib/trpc.tsx';

export function useDeleteOpenAiSettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();
    return trpc.openAiSettings.delete.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.openAiSettings.get.invalidate(),
                utils.modelAccess.get.invalidate(),
                utils.model.inventory.invalidate(),
            ]);
            await options?.onSuccess?.();
        },
    });
}
