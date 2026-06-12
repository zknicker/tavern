import { skillHubSearchInputSchema } from '../../skills/contracts.ts';
import { searchSkillHub } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubSearchProcedure = publicProcedure
    .input(skillHubSearchInputSchema)
    .query(async ({ input }) => await searchSkillHub(input));
