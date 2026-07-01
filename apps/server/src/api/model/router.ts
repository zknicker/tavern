import { createRouter } from '../trpc.ts';
import { listModelInventoryProcedure } from './inventory.ts';
import { listModelsProcedure } from './list.ts';
import { onModelUpdate } from './on-update.ts';
import { setModelProviderEnabledProcedure } from './set-provider-enabled.ts';

export const modelRouter = createRouter({
    inventory: listModelInventoryProcedure,
    list: listModelsProcedure,
    onUpdate: onModelUpdate,
    setProviderEnabled: setModelProviderEnabledProcedure,
});
