import { createRouter } from '../trpc.ts';
import { getTimezoneSettingsProcedure, saveTimezoneSettingsProcedure } from './settings.ts';

export const timezoneRouter = createRouter({
    saveSettings: saveTimezoneSettingsProcedure,
    settings: getTimezoneSettingsProcedure,
});
