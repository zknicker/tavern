import { setToolsetEnabledInputSchema } from '../../skills/contracts.ts';
import { setToolsetEnabled } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const setToolsetEnabledProcedure = publicProcedure
    .input(setToolsetEnabledInputSchema)
    .mutation(async ({ input }) => await setToolsetEnabled(input));
