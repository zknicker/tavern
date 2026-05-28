import {
    cortexCaptureInputSchema,
    cortexJobNameSchema,
    cortexRecallInputSchema,
    cortexSaveSettingsSchema,
    cortexSearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    captureCortex,
    getCortexPage,
    getCortexSettings,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    runCortexJob,
    saveCortexSettings,
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
    saveSettings: publicProcedure
        .input(cortexSaveSettingsSchema)
        .mutation(({ input }) => saveCortexSettings(input)),
    search: publicProcedure
        .input(cortexSearchInputSchema)
        .query(({ input }) => searchCortex(input)),
    settings: publicProcedure.query(() => getCortexSettings()),
    status: publicProcedure.query(() => getCortexStatus()),
});
