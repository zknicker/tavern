import { saveMemorySettingsInputSchema } from '../../memory/contracts.ts';
import { saveMemorySettings } from '../../memory/service.ts';
import { publicProcedure } from '../trpc.ts';

export const saveMemorySettingsProcedure = publicProcedure
    .input(saveMemorySettingsInputSchema)
    .mutation(async ({ input }) => {
        return await saveMemorySettings(input);
    });
