import { z } from 'zod';
import { refreshJobSchedule } from '../../jobs/manager.ts';
import { saveOpenRouterSettings } from '../../openrouter/settings.ts';
import { deleteOpenRouterUsageOverview } from '../../storage/provider-usage.ts';
import {
    emitModelUpdated,
    emitOpenRouterSettingsInvalidationCascade,
} from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';
import { toOpenRouterSettingsOutput } from './shared.ts';

const openRouterKeyInputSchema = z
    .string()
    .trim()
    .nullable()
    .transform((value) => value?.trim() ?? '')
    .refine((value) => value.length === 0 || value.length >= 20, 'Enter a valid OpenRouter key.')
    .refine(
        (value) => value.length === 0 || /^sk-or(?:-v1)?-[A-Za-z0-9_-]+$/u.test(value),
        'Enter a valid OpenRouter key.'
    );

const saveOpenRouterSettingsInputSchema = z.object({
    apiKey: openRouterKeyInputSchema,
    managementApiKey: openRouterKeyInputSchema,
});

export const saveOpenRouterSettingsProcedure = publicProcedure
    .input(saveOpenRouterSettingsInputSchema)
    .mutation(async ({ input }) => {
        const settings = await saveOpenRouterSettings({
            apiKey: input.apiKey,
            managementApiKey: input.managementApiKey,
        });

        if (input.managementApiKey) {
            await deleteOpenRouterUsageOverview();
            await refreshJobSchedule('sync-openrouter-usage', {
                runImmediately: true,
            });
        } else {
            await deleteOpenRouterUsageOverview();
            await refreshJobSchedule('sync-openrouter-usage');
        }
        emitOpenRouterSettingsInvalidationCascade();
        emitModelUpdated();

        return toOpenRouterSettingsOutput(settings);
    });
