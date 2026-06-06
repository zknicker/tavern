import { getOpenAiSettings } from '../../openai/settings.ts';
import { publicProcedure } from '../trpc.ts';
import { toOpenAiSettingsOutput } from './shared.ts';

export const getOpenAiSettingsProcedure = publicProcedure.query(async () => {
    const settings = await getOpenAiSettings();
    return toOpenAiSettingsOutput(settings);
});
