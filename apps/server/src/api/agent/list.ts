import { listAgentCatalog } from '../../agents/catalog.ts';
import { publicProcedure } from '../trpc.ts';

export const listAgents = publicProcedure.query(async () => {
    return {
        agents: await listAgentCatalog(),
    };
});
