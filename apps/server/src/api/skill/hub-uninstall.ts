import { skillHubUninstallInputSchema } from '../../skills/contracts.ts';
import { uninstallSkillHubSkill } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubUninstallProcedure = publicProcedure
    .input(skillHubUninstallInputSchema)
    .mutation(async ({ input }) => await uninstallSkillHubSkill(input));
