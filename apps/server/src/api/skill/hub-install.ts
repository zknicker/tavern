import { skillHubInstallInputSchema } from '../../skills/contracts.ts';
import { installSkillHubSkill } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubInstallProcedure = publicProcedure
    .input(skillHubInstallInputSchema)
    .mutation(async ({ input }) => await installSkillHubSkill(input));
