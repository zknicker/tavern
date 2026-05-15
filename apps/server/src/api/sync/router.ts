import { createRouter } from '../trpc.ts';
import { onDataUpdate } from './on-data-update.ts';

export const syncRouter = createRouter({
    onDataUpdate,
});
