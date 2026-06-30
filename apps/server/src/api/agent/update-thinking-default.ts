import { agentRuntimeThinkingLevelSchema } from '@tavern/api';
import { z } from 'zod';
import { updateAgentThinkingDefault } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentThinkingDefaultProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            thinkingDefault: agentRuntimeThinkingLevelSchema.nullable(),
        })
    )
    .mutation(async ({ input }) => await updateAgentThinkingDefault(input));
