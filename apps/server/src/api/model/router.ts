import { createRouter } from '../trpc.ts';
import {
    getModelCategorySettingsProcedure,
    saveModelCategorySettingsProcedure,
} from './category-settings.ts';
import { listModelInventoryProcedure } from './inventory.ts';
import { listModelsProcedure } from './list.ts';
import { onModelUpdate } from './on-update.ts';
import { setModelProviderEnabledProcedure } from './set-provider-enabled.ts';

export const modelRouter = createRouter({
    categorySettings: getModelCategorySettingsProcedure,
    inventory: listModelInventoryProcedure,
    list: listModelsProcedure,
    onUpdate: onModelUpdate,
    saveCategorySettings: saveModelCategorySettingsProcedure,
    setProviderEnabled: setModelProviderEnabledProcedure,
});
