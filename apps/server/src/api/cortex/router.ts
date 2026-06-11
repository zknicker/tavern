import { cortexSearchInputSchema } from '@tavern/api';
import { z } from 'zod';
import {
    getCortexHealth,
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    listCortexTopics,
    searchCortex,
} from '../../cortex/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';

export const cortexRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ path: z.string().trim().min(1), topic: z.string().trim().min(1) }))
        .query(({ input }) => listCortexBacklinks(input)),
    get: publicProcedure
        .input(z.object({ path: z.string().trim().min(1), topic: z.string().trim().min(1) }))
        .query(({ input }) => getCortexPage(input)),
    health: publicProcedure.query(() => getCortexHealth()),
    list: publicProcedure
        .input(
            z
                .object({
                    includeArchived: z.boolean().optional(),
                    topic: z.string().trim().min(1).nullable().optional(),
                })
                .optional()
        )
        .query(({ input }) => listCortexPages(input ?? {})),
    search: publicProcedure
        .input(cortexSearchInputSchema)
        .query(({ input }) => searchCortex(input)),
    status: publicProcedure.query(() => getCortexStatus()),
    topics: publicProcedure
        .input(z.object({ includeArchived: z.boolean().optional() }).optional())
        .query(({ input }) => listCortexTopics(input ?? {})),
});
