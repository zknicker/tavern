import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from '../models/invalidate-model-list.ts';

export function useSaveModelProviderApiKey(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.modelAccess.saveProviderApiKey.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.model.inventory.invalidate(),
                utils.modelAccess.get.invalidate(),
                invalidateModelList(utils),
            ]);
            await options?.onSuccess?.();
        },
    });
}
