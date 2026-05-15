import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from './invalidate-model-list.ts';

export function useAddCatalogModel() {
    const utils = trpc.useUtils();

    return trpc.model.addCatalogModel.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.model.inventory.invalidate(), invalidateModelList(utils)]);
        },
    });
}
