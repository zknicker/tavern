import { applyOpenClawConfigInputSchema } from '../../openclaw-config/contracts.ts';
import { applyOpenClawConfig } from '../../openclaw-config/service.ts';
import { publicProcedure } from '../trpc.ts';

export const applyOpenClawConfigProcedure = publicProcedure
    .input(applyOpenClawConfigInputSchema)
    .mutation(async ({ input }) => await applyOpenClawConfig(input));
