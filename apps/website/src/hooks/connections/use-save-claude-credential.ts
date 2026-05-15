import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from '../models/invalidate-model-list.ts';

export function useSaveClaudeCredential(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.modelAccess.saveClaudeCredential.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.modelAccess.get.invalidate(),
                utils.model.inventory.invalidate(),
                invalidateModelList(utils),
            ]);
            await options?.onSuccess?.();
        },
    });
}
