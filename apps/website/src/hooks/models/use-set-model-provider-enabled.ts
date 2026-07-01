import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from './invalidate-model-list.ts';

export function useSetModelProviderEnabled() {
    const utils = trpc.useUtils();
    return trpc.model.setProviderEnabled.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.model.inventory.invalidate(), invalidateModelList(utils)]);
        },
    });
}
