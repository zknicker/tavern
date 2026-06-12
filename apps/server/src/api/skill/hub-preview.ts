import { skillHubIdentifierInputSchema } from '../../skills/contracts.ts';
import { previewSkillHubSkill } from '../../skills/hub-service.ts';
import { publicProcedure } from '../trpc.ts';

export const skillHubPreviewProcedure = publicProcedure
    .input(skillHubIdentifierInputSchema)
    .query(async ({ input }) => await previewSkillHubSkill(input));
