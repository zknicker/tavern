import { deleteCatalogModelInputSchema } from '../../model/inventory-contracts.ts';
import { deleteCatalogModel } from '../../model/inventory-service.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteCatalogModelProcedure = publicProcedure
    .input(deleteCatalogModelInputSchema)
    .mutation(async ({ input }) => await deleteCatalogModel(input));
