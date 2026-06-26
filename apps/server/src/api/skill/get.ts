import { agentRuntimeSkillSchema } from '@tavern/api';
import { skillIdSchema } from '../../skills/contracts.ts';
import { getSkill } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getSkillProcedure = publicProcedure
    .input(skillIdSchema)
    .output(agentRuntimeSkillSchema)
    .query(async ({ input }) => await getSkill(input));
