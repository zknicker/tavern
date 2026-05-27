import { createRouter } from '../trpc.ts';
import { getModelAccessProcedure } from './get.ts';

export const modelAccessRouter = createRouter({
    get: getModelAccessProcedure,
});
