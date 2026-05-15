import { installSkillInputSchema } from '../../skills/contracts.ts';
import { installSkill } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const installSkillProcedure = publicProcedure
    .input(installSkillInputSchema)
    .mutation(({ input }) => installSkill(input));
