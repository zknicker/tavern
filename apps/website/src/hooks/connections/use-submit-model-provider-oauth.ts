import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from '../models/invalidate-model-list.ts';

export function useSubmitModelProviderOAuth(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.modelAccess.submitProviderOAuth.useMutation({
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
