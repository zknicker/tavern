import {
    mcpCatalogInstallInputSchema,
    mcpServerCreateInputSchema,
    mcpServerEnabledInputSchema,
    mcpServerNameInputSchema,
} from '../../mcp/contracts.ts';
import {
    addMcpServer,
    getMcpCatalog,
    installMcpCatalogEntry,
    listMcpServers,
    removeMcpServer,
    setMcpServerEnabled,
    testMcpServer,
} from '../../mcp/service.ts';
import { publicProcedure } from '../trpc.ts';

export const mcpServersProcedure = publicProcedure.query(async () => await listMcpServers());

export const addMcpServerProcedure = publicProcedure
    .input(mcpServerCreateInputSchema)
    .mutation(async ({ input }) => await addMcpServer(input));

export const removeMcpServerProcedure = publicProcedure
    .input(mcpServerNameInputSchema)
    .mutation(async ({ input }) => await removeMcpServer(input));

export const testMcpServerProcedure = publicProcedure
    .input(mcpServerNameInputSchema)
    .mutation(async ({ input }) => await testMcpServer(input));

export const setMcpServerEnabledProcedure = publicProcedure
    .input(mcpServerEnabledInputSchema)
    .mutation(async ({ input }) => await setMcpServerEnabled(input));

export const mcpCatalogProcedure = publicProcedure.query(async () => await getMcpCatalog());

export const installMcpCatalogEntryProcedure = publicProcedure
    .input(mcpCatalogInstallInputSchema)
    .mutation(async ({ input }) => await installMcpCatalogEntry(input));
