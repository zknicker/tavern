import { getOpenRouterSettings } from '../../openrouter/settings.ts';
import { publicProcedure } from '../trpc.ts';
import { toOpenRouterSettingsOutput } from './shared.ts';

export const getOpenRouterSettingsProcedure = publicProcedure.query(async () => {
    const settings = await getOpenRouterSettings();
    return toOpenRouterSettingsOutput(settings);
});
