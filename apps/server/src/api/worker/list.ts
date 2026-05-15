import { listWorkers } from '../../workers/list.ts';
import { publicProcedure } from '../trpc.ts';

export const listWorkersRoute = publicProcedure.query(async () => {
    return await listWorkers();
});
