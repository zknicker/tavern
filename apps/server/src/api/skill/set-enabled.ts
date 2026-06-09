import { setSkillEnabledInputSchema } from '../../skills/contracts.ts';
import { setSkillEnabled } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const setSkillEnabledProcedure = publicProcedure
    .input(setSkillEnabledInputSchema)
    .mutation(async ({ input }) => await setSkillEnabled(input));
