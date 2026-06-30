import { setToolEnabledInputSchema } from '../../skills/contracts.ts';
import { setToolEnabled } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const setToolEnabledProcedure = publicProcedure
    .input(setToolEnabledInputSchema)
    .mutation(async ({ input }) => await setToolEnabled(input));
