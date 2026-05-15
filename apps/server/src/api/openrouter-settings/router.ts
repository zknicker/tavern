import { createRouter } from '../trpc.ts';
import { deleteOpenRouterSettingsProcedure } from './delete.ts';
import { getOpenRouterSettingsProcedure } from './get.ts';
import { onOpenRouterSettingsUpdate } from './on-update.ts';
import { saveOpenRouterSettingsProcedure } from './save.ts';

export const openRouterSettingsRouter = createRouter({
    delete: deleteOpenRouterSettingsProcedure,
    get: getOpenRouterSettingsProcedure,
    onUpdate: onOpenRouterSettingsUpdate,
    save: saveOpenRouterSettingsProcedure,
});
