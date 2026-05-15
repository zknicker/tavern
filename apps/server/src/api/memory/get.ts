import { getMemorySettings } from '../../memory/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getMemorySettingsProcedure = publicProcedure.query(async () => {
    return await getMemorySettings();
});
