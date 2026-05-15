import { createRouter } from '../trpc.ts';
import { listSubAgentsRoute } from './list.ts';

export const subAgentRouter = createRouter({
    list: listSubAgentsRoute,
});
