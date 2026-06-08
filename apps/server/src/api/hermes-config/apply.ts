import { applyHermesConfigInputSchema } from '../../hermes-config/contracts.ts';
import { applyHermesConfig } from '../../hermes-config/service.ts';
import { publicProcedure } from '../trpc.ts';

export const applyHermesConfigProcedure = publicProcedure
    .input(applyHermesConfigInputSchema)
    .mutation(async ({ input }) => await applyHermesConfig(input));
