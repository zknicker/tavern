import { deleteOpenAiSettings } from '../../openai/settings.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteOpenAiSettingsProcedure = publicProcedure.mutation(async () => {
    await deleteOpenAiSettings();
    emitModelUpdated();
    return {
        apiKey: '',
        hasApiKey: false,
        updatedAt: null,
    };
});
