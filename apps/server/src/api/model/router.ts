import { createRouter } from '../trpc.ts';
import { addCatalogModelProcedure } from './add-catalog-model.ts';
import { deleteCatalogModelProcedure } from './delete-catalog-model.ts';
import { listModelInventoryProcedure } from './inventory.ts';
import { listModelsProcedure } from './list.ts';
import { onModelUpdate } from './on-update.ts';

export const modelRouter = createRouter({
    addCatalogModel: addCatalogModelProcedure,
    deleteCatalogModel: deleteCatalogModelProcedure,
    inventory: listModelInventoryProcedure,
    list: listModelsProcedure,
    onUpdate: onModelUpdate,
});
