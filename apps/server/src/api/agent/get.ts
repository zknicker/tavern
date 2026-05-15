import { z } from 'zod';
import { getAgentDetail } from '../../agents/detail.ts';
import { publicProcedure } from '../trpc.ts';

const getAgentInputSchema = z.object({
    agentId: z.string().min(1),
});

export const getAgent = publicProcedure.input(getAgentInputSchema).query(async ({ input }) => {
    return getAgentDetail(input.agentId);
});
