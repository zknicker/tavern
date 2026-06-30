import { createRouter } from '../trpc.ts';
import {
    addMcpServerProcedure,
    installMcpCatalogEntryProcedure,
    mcpCatalogProcedure,
    mcpServersProcedure,
    removeMcpServerProcedure,
    setMcpServerEnabledProcedure,
    testMcpServerProcedure,
} from './procedures.ts';

export const mcpRouter = createRouter({
    add: addMcpServerProcedure,
    catalog: mcpCatalogProcedure,
    install: installMcpCatalogEntryProcedure,
    list: mcpServersProcedure,
    remove: removeMcpServerProcedure,
    setEnabled: setMcpServerEnabledProcedure,
    test: testMcpServerProcedure,
});
