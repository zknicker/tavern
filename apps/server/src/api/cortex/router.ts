import {
    cortexCaptureInputSchema,
    cortexEditPageInputSchema,
    cortexRecallInputSchema,
    cortexSaveSchemaInputSchema,
    cortexSaveSettingsSchema,
    cortexSearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    captureCortex,
    editCortexPage,
    getCortexPage,
    getCortexSchema,
    getCortexSchemaAdditions,
    getCortexSettings,
    getCortexStatus,
    listCortexBacklinks,
    listCortexDreamReports,
    listCortexPages,
    recallCortex,
    saveCortexSchema,
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
    edit: publicProcedure
        .input(cortexEditPageInputSchema)
        .mutation(({ input }) => editCortexPage(input)),
    get: publicProcedure
        .input(z.object({ slugOrId: z.string().trim().min(1) }))
        .query(({ input }) => getCortexPage(input.slugOrId)),
    list: publicProcedure.query(() => listCortexPages()),
    dreamReports: publicProcedure
        .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
        .query(({ input }) => listCortexDreamReports(input ?? {})),
    recall: publicProcedure
        .input(cortexRecallInputSchema)
        .mutation(({ input }) => recallCortex(input)),
    saveSchema: publicProcedure
        .input(cortexSaveSchemaInputSchema)
        .mutation(({ input }) => saveCortexSchema(input)),
    saveSettings: publicProcedure
        .input(cortexSaveSettingsSchema)
        .mutation(({ input }) => saveCortexSettings(input)),
    schema: publicProcedure.query(() => getCortexSchema()),
    schemaAdditions: publicProcedure.query(() => getCortexSchemaAdditions()),
    search: publicProcedure
        .input(cortexSearchInputSchema)
        .query(({ input }) => searchCortex(input)),
    settings: publicProcedure.query(() => getCortexSettings()),
    status: publicProcedure.query(() => getCortexStatus()),
});
