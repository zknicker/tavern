import {
    agentRuntimeSaveVaultSettingsSchema,
    vaultCreatePageSchema,
    vaultMovePathSchema,
    vaultPathInputSchema,
    vaultSavePageSchema,
    vaultSearchInputSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    createVaultFolder,
    createVaultPage,
    deleteVaultFolder,
    deleteVaultPage,
    getVaultPage,
    getVaultSettings,
    getVaultStatus,
    listVaultBacklinks,
    listVaultPages,
    moveVaultPath,
    saveVaultPage,
    saveVaultSettings,
    searchVault,
} from '../../vault/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';
import { onVaultUpdate } from './on-update.ts';

export const vaultRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => listVaultBacklinks(input)),
    createFolder: publicProcedure
        .input(vaultPathInputSchema)
        .mutation(({ input }) => createVaultFolder(input)),
    createPage: publicProcedure
        .input(vaultCreatePageSchema)
        .mutation(({ input }) => createVaultPage(input)),
    deleteFolder: publicProcedure
        .input(vaultPathInputSchema)
        .mutation(({ input }) => deleteVaultFolder(input)),
    deletePage: publicProcedure
        .input(vaultPathInputSchema)
        .mutation(({ input }) => deleteVaultPage(input)),
    get: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => getVaultPage(input)),
    list: publicProcedure.query(() => listVaultPages()),
    movePath: publicProcedure
        .input(vaultMovePathSchema)
        .mutation(({ input }) => moveVaultPath(input)),
    onUpdate: onVaultUpdate,
    savePage: publicProcedure
        .input(vaultSavePageSchema)
        .mutation(({ input }) => saveVaultPage(input)),
    saveSettings: publicProcedure
        .input(agentRuntimeSaveVaultSettingsSchema)
        .mutation(({ input }) => saveVaultSettings(input)),
    search: publicProcedure.input(vaultSearchInputSchema).query(({ input }) => searchVault(input)),
    settings: publicProcedure.query(() => getVaultSettings()),
    status: publicProcedure.query(() => getVaultStatus()),
});
