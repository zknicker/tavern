import { z } from 'zod';
import { updateAgentName } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentNameProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            // Agent names are handles: single tokens, validated at the edge.
            name: z
                .string()
                .trim()
                .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u, {
                    message:
                        'Agent name must be a single token (letters, numbers, - or _), 1-32 chars.',
                }),
        })
    )
    .mutation(async ({ input }) => await updateAgentName(input));
