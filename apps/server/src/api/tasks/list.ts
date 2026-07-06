import { listTasks } from '../../tasks/list.ts';
import { publicProcedure } from '../trpc.ts';

export const listTasksRoute = publicProcedure.query(async () => {
    return await listTasks();
});
