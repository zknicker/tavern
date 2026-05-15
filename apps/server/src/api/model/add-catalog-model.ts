import { addCatalogModelInputSchema } from '../../model/inventory-contracts.ts';
import { addCatalogModel } from '../../model/inventory-service.ts';
import { publicProcedure } from '../trpc.ts';

export const addCatalogModelProcedure = publicProcedure
    .input(addCatalogModelInputSchema)
    .mutation(async ({ input }) => await addCatalogModel(input));
