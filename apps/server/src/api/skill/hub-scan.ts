import { skillHubIdentifierInputSchema } from '../../skills/contracts.ts';
import { scanSkillHubSkill } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubScanProcedure = publicProcedure
    .input(skillHubIdentifierInputSchema)
    .query(async ({ input }) => await scanSkillHubSkill(input));
