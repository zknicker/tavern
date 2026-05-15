import { saveSkillSecretInputSchema } from '../../skills/contracts.ts';
import { saveSkillSecret } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const saveSkillSecretProcedure = publicProcedure
    .input(saveSkillSecretInputSchema)
    .mutation(async ({ input }) => await saveSkillSecret(input));
