import { createRouter } from '../trpc.ts';
import { listWorkersRoute } from './list.ts';
import { onWorkersUpdate } from './on-update.ts';

export const workerRouter = createRouter({
    list: listWorkersRoute,
    onUpdate: onWorkersUpdate,
});
