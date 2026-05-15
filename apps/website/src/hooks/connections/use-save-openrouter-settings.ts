import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from '../models/invalidate-model-list.ts';

export function useSaveOpenRouterSettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.openRouterSettings.save.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.model.inventory.invalidate(),
                invalidateModelList(utils),
                utils.openRouterSettings.get.invalidate(),
                utils.usage.live.invalidate(),
            ]);
            await options?.onSuccess?.();
        },
    });
}
