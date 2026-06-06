import { createRouter } from '../trpc.ts';
import { deleteOpenAiSettingsProcedure } from './delete.ts';
import { getOpenAiSettingsProcedure } from './get.ts';
import { saveOpenAiSettingsProcedure } from './save.ts';

export const openAiSettingsRouter = createRouter({
    delete: deleteOpenAiSettingsProcedure,
    get: getOpenAiSettingsProcedure,
    save: saveOpenAiSettingsProcedure,
});
