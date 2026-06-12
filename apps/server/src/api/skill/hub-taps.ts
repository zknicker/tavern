import { skillHubTapInputSchema, skillHubTapRemoveInputSchema } from '../../skills/contracts.ts';
import { addSkillHubTap, listSkillHubTaps, removeSkillHubTap } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubTapListProcedure = publicProcedure.query(async () => await listSkillHubTaps());

export const skillHubTapAddProcedure = publicProcedure
    .input(skillHubTapInputSchema)
    .mutation(async ({ input }) => await addSkillHubTap(input));

export const skillHubTapRemoveProcedure = publicProcedure
    .input(skillHubTapRemoveInputSchema)
    .mutation(async ({ input }) => await removeSkillHubTap(input));
