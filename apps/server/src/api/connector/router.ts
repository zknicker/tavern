import { createRouter } from '../trpc.ts';
import { createConnectorProcedure } from './create.ts';
import { deleteConnectorProcedure } from './delete.ts';
import { listConnectorsProcedure } from './list.ts';
import { testConnectorProcedure } from './test.ts';
import { updateConnectorProcedure } from './update.ts';

export const connectorRouter = createRouter({
    create: createConnectorProcedure,
    delete: deleteConnectorProcedure,
    list: listConnectorsProcedure,
    test: testConnectorProcedure,
    update: updateConnectorProcedure,
});
