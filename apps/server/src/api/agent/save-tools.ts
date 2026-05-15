import { z } from 'zod';
import { saveAgentToolPolicy } from '../../agents/tool-policy.ts';
import { emitAgentInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const saveAgentToolsInputSchema = z.object({
    agentId: z.string().trim().min(1),
    tools: z.array(z.string().trim().min(1).max(128)),
});

export const saveAgentToolsProcedure = publicProcedure
    .input(saveAgentToolsInputSchema)
    .mutation(async ({ input }) => {
        const result = await saveAgentToolPolicy(input);
        emitAgentInvalidationCascade();
        return result;
    });
