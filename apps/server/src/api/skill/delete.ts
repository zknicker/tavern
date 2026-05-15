import { deleteSkillInputSchema } from '../../skills/contracts.ts';
import { deleteSkill } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteSkillProcedure = publicProcedure
    .input(deleteSkillInputSchema)
    .mutation(({ input }) => deleteSkill(input));
