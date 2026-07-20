import {
    agentRuntimeSaveWikiSettingsSchema,
    wikiCreatePageSchema,
    wikiMovePathSchema,
    wikiPathInputSchema,
    wikiSavePageSchema,
    wikiSearchInputSchema,
    wikiUploadAttachmentSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    createWikiFolder,
    createWikiPage,
    deleteWikiFolder,
    deleteWikiPage,
    getWikiAttachment,
    getWikiPage,
    getWikiPageHistory,
    getWikiPageRevision,
    getWikiSettings,
    getWikiStatus,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    saveWikiPage,
    saveWikiSettings,
    searchWiki,
    uploadWikiAttachment,
} from '../../wiki/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';
import { onWikiUpdate } from './on-update.ts';

export const wikiRouter = createRouter({
    attachment: publicProcedure
        .input(wikiPathInputSchema)
        .query(({ input }) => getWikiAttachment(input)),
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
    history: publicProcedure
        .input(
            z.object({
                limit: z.number().int().positive().max(200).optional(),
                path: z.string().trim().min(1),
            })
        )
        .query(({ input }) => getWikiPageHistory(input)),
    list: publicProcedure.query(() => listWikiPages()),
    movePath: publicProcedure
        .input(wikiMovePathSchema)
        .mutation(({ input }) => moveWikiPath(input)),
    onUpdate: onWikiUpdate,
    revision: publicProcedure
        .input(
            z.object({
                commit: z.string().regex(/^[0-9a-f]{4,40}$/iu),
                path: z.string().trim().min(1),
            })
        )
        .query(({ input }) => getWikiPageRevision(input)),
    savePage: publicProcedure
        .input(wikiSavePageSchema)
        .mutation(({ input }) => saveWikiPage(input)),
    saveSettings: publicProcedure
        .input(agentRuntimeSaveWikiSettingsSchema)
        .mutation(({ input }) => saveWikiSettings(input)),
    search: publicProcedure.input(wikiSearchInputSchema).query(({ input }) => searchWiki(input)),
    settings: publicProcedure.query(() => getWikiSettings()),
    status: publicProcedure.query(() => getWikiStatus()),
    uploadAttachment: publicProcedure
        .input(wikiUploadAttachmentSchema)
        .mutation(({ input }) => uploadWikiAttachment(input)),
});
