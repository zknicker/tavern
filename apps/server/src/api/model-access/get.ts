import { listModelAccessStatuses } from '../../model-access/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getModelAccessProcedure = publicProcedure.query(async () => {
    return {
        providers: await listModelAccessStatuses(),
    };
});
