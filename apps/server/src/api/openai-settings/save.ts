import { z } from 'zod';
import { saveOpenAiSettings } from '../../openai/settings.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';
import { toOpenAiSettingsOutput } from './shared.ts';

const saveOpenAiSettingsInputSchema = z.object({
    apiKey: z
        .string()
        .trim()
        .refine((value) => /^sk-[A-Za-z0-9_-]{20,}$/u.test(value), 'Enter an OpenAI API key.'),
});

export const saveOpenAiSettingsProcedure = publicProcedure
    .input(saveOpenAiSettingsInputSchema)
    .mutation(async ({ input }) => {
        const settings = await saveOpenAiSettings(input);
        emitModelUpdated();
        return toOpenAiSettingsOutput(settings);
    });
