import {
    cortexCaptureInputSchema,
    cortexJobNameSchema,
    cortexRecallInputSchema,
    cortexSearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    captureCortex,
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    runCortexJob,
    searchCortex,
} from '../../cortex/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';

export const cortexRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ slugOrId: z.string().trim().min(1) }))
        .query(({ input }) => listCortexBacklinks(input.slugOrId)),
    capture: publicProcedure
        .input(cortexCaptureInputSchema)
        .mutation(({ input }) => captureCortex(input)),
    get: publicProcedure
        .input(z.object({ slugOrId: z.string().trim().min(1) }))
        .query(({ input }) => getCortexPage(input.slugOrId)),
    list: publicProcedure.query(() => listCortexPages()),
    recall: publicProcedure
        .input(cortexRecallInputSchema)
        .mutation(({ input }) => recallCortex(input)),
    runJob: publicProcedure.input(cortexJobNameSchema).mutation(({ input }) => runCortexJob(input)),
    search: publicProcedure
        .input(cortexSearchInputSchema)
        .query(({ input }) => searchCortex(input)),
    status: publicProcedure.query(() => getCortexStatus()),
});
