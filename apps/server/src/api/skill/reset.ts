import { agentRuntimeSkillResetResultSchema } from '@tavern/api';
import { skillResetInputSchema } from '../../skills/contracts.ts';
import { resetSkill } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const resetSkillProcedure = publicProcedure
    .input(skillResetInputSchema)
    .output(agentRuntimeSkillResetResultSchema)
    .mutation(async ({ input }) => await resetSkill(input));
