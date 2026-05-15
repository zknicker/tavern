import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from './invalidate-model-list.ts';

export function useDeleteCatalogModel() {
    const utils = trpc.useUtils();

    return trpc.model.deleteCatalogModel.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.model.inventory.invalidate(), invalidateModelList(utils)]);
        },
    });
}
