import { agentRuntimeSaveVaultSettingsSchema, vaultSearchInputSchema } from '@tavern/api';
import { z } from 'zod';
import {
    getVaultPage,
    getVaultSettings,
    getVaultStatus,
    listVaultBacklinks,
    listVaultPages,
    saveVaultSettings,
    searchVault,
} from '../../vault/service.ts';
import { createRouter, publicProcedure } from '../trpc.ts';

export const vaultRouter = createRouter({
    backlinks: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => listVaultBacklinks(input)),
    get: publicProcedure
        .input(z.object({ path: z.string().trim().min(1) }))
        .query(({ input }) => getVaultPage(input)),
    list: publicProcedure.query(() => listVaultPages()),
    saveSettings: publicProcedure
        .input(agentRuntimeSaveVaultSettingsSchema)
        .mutation(({ input }) => saveVaultSettings(input)),
    search: publicProcedure.input(vaultSearchInputSchema).query(({ input }) => searchVault(input)),
    settings: publicProcedure.query(() => getVaultSettings()),
    status: publicProcedure.query(() => getVaultStatus()),
});
