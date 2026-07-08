import {
    agentRuntimeSaveWikiSettingsSchema,
    wikiCreatePageSchema,
    wikiMovePathSchema,
    wikiPathInputSchema,
    wikiSavePageSchema,
    wikiSearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    createWikiFolder,
    createWikiPage,
    deleteWikiFolder,
    deleteWikiPage,
    getWikiPage,
    getWikiSettings,
    getWikiStatus,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    saveWikiPage,
    saveWikiSettings,
    searchWiki,
} from '../../wiki/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';
import { onWikiUpdate } from './on-update.ts';

export const wikiRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => listWikiBacklinks(input)),
    createFolder: publicProcedure
        .input(wikiPathInputSchema)
        .mutation(({ input }) => createWikiFolder(input)),
    createPage: publicProcedure
        .input(wikiCreatePageSchema)
        .mutation(({ input }) => createWikiPage(input)),
    deleteFolder: publicProcedure
        .input(wikiPathInputSchema)
        .mutation(({ input }) => deleteWikiFolder(input)),
    deletePage: publicProcedure
        .input(wikiPathInputSchema)
        .mutation(({ input }) => deleteWikiPage(input)),
    get: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => getWikiPage(input)),
    list: publicProcedure.query(() => listWikiPages()),
    movePath: publicProcedure
        .input(wikiMovePathSchema)
        .mutation(({ input }) => moveWikiPath(input)),
    onUpdate: onWikiUpdate,
    savePage: publicProcedure
        .input(wikiSavePageSchema)
        .mutation(({ input }) => saveWikiPage(input)),
    saveSettings: publicProcedure
        .input(agentRuntimeSaveWikiSettingsSchema)
        .mutation(({ input }) => saveWikiSettings(input)),
    search: publicProcedure.input(wikiSearchInputSchema).query(({ input }) => searchWiki(input)),
    settings: publicProcedure.query(() => getWikiSettings()),
    status: publicProcedure.query(() => getWikiStatus()),
});
