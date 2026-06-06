import { trpc } from '../../lib/trpc.tsx';

export function useSaveOpenAiSettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();
    return trpc.openAiSettings.save.useMutation({
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
