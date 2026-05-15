import { getSkillInputSchema, skillGetSchema } from '../../skills/contracts.ts';
import { getSkill } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getSkillProcedure = publicProcedure
    .input(getSkillInputSchema)
    .output(skillGetSchema)
    .query(({ input }) => getSkill(input));
