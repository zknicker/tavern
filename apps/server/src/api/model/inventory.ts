import { listModelInventory } from '../../model/inventory-service.ts';
import { publicProcedure } from '../trpc.ts';

export const listModelInventoryProcedure = publicProcedure.query(
    async () => await listModelInventory()
);
