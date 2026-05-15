import { deleteSkillSecretInputSchema } from '../../skills/contracts.ts';
import { deleteSkillSecret } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteSkillSecretProcedure = publicProcedure
    .input(deleteSkillSecretInputSchema)
    .mutation(async ({ input }) => await deleteSkillSecret(input));
