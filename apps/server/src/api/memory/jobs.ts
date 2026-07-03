import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const listMemoryJobsProcedure = publicProcedure
    .input(
        z
            .object({
                agentId: z.string().trim().min(1).optional(),
                limit: z.number().int().positive().max(200).optional(),
            })
            .optional()
    )
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.listMemoryJobs(input ?? {});
        } finally {
            client.close();
        }
    });

export const getMemoryJobProcedure = publicProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.getMemoryJob(input.id);
        } finally {
            client.close();
        }
    });

export const runMemoryDreamProcedure = publicProcedure
    .input(z.object({ agentId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.runMemoryDream(input.agentId);
        } finally {
            client.close();
        }
    });
