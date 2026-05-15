import {
    checkSkillUpdatesInputSchema,
    checkSkillUpdatesResultSchema,
} from '../../skills/contracts.ts';
import { checkSkillForUpdates } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const checkSkillUpdatesProcedure = publicProcedure
    .input(checkSkillUpdatesInputSchema)
    .output(checkSkillUpdatesResultSchema)
    .mutation(({ input }) => checkSkillForUpdates(input));
