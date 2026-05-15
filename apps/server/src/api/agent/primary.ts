import { getPrimaryAgent } from '../../agents/catalog.ts';
import { publicProcedure } from '../trpc.ts';

export const getPrimaryAgentRoute = publicProcedure.query(async () => {
    return {
        agent: await getPrimaryAgent(),
    };
});
