import { z } from 'zod';
import {
    agentPrimaryColorSchema,
    agentSoulSchema,
    saveCatalogAgentProfile,
} from '../../agents/catalog.ts';
import { emitAgentInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const saveAgentProfileInputSchema = z
    .object({
        agentId: z.string().trim().min(1),
        primaryColor: agentPrimaryColorSchema.optional(),
        soul: agentSoulSchema.optional(),
    })
    .refine((input) => input.primaryColor !== undefined || input.soul !== undefined, {
        message: 'Choose a profile field to update.',
    });

export const saveAgentProfile = publicProcedure
    .input(saveAgentProfileInputSchema)
    .mutation(async ({ input }) => {
        const agent = await saveCatalogAgentProfile(input);
        emitAgentInvalidationCascade();
        return {
            agent,
        };
    });
