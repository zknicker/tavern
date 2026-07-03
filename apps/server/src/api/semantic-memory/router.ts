import {
    agentRuntimeSaveSemanticMemorySettingsSchema,
    memoryPathInputSchema,
    semanticMemoryCreatePageSchema,
    semanticMemoryMovePathSchema,
    semanticMemorySavePageSchema,
    semanticMemorySearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    createSemanticMemoryFolder,
    createSemanticMemoryPage,
    deleteSemanticMemoryFolder,
    deleteSemanticMemoryPage,
    getSemanticMemoryPage,
    getSemanticMemorySettings,
    getSemanticMemoryStatus,
    listSemanticMemoryBacklinks,
    listSemanticMemoryPages,
    moveSemanticMemoryPath,
    saveSemanticMemoryPage,
    saveSemanticMemorySettings,
    searchSemanticMemory,
} from '../../semantic-memory/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';
import { onSemanticMemoryUpdate } from './on-update.ts';

export const semanticMemoryRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => listSemanticMemoryBacklinks(input)),
    createFolder: publicProcedure
        .input(memoryPathInputSchema)
        .mutation(({ input }) => createSemanticMemoryFolder(input)),
    createPage: publicProcedure
        .input(semanticMemoryCreatePageSchema)
        .mutation(({ input }) => createSemanticMemoryPage(input)),
    deleteFolder: publicProcedure
        .input(memoryPathInputSchema)
        .mutation(({ input }) => deleteSemanticMemoryFolder(input)),
    deletePage: publicProcedure
        .input(memoryPathInputSchema)
        .mutation(({ input }) => deleteSemanticMemoryPage(input)),
    get: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => getSemanticMemoryPage(input)),
    list: publicProcedure.query(() => listSemanticMemoryPages()),
    movePath: publicProcedure
        .input(semanticMemoryMovePathSchema)
        .mutation(({ input }) => moveSemanticMemoryPath(input)),
    onUpdate: onSemanticMemoryUpdate,
    savePage: publicProcedure
        .input(semanticMemorySavePageSchema)
        .mutation(({ input }) => saveSemanticMemoryPage(input)),
    saveSettings: publicProcedure
        .input(agentRuntimeSaveSemanticMemorySettingsSchema)
        .mutation(({ input }) => saveSemanticMemorySettings(input)),
    search: publicProcedure
        .input(semanticMemorySearchInputSchema)
        .query(({ input }) => searchSemanticMemory(input)),
    settings: publicProcedure.query(() => getSemanticMemorySettings()),
    status: publicProcedure.query(() => getSemanticMemoryStatus()),
});
