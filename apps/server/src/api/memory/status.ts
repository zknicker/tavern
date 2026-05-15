import { getMemoryStatus } from '../../memory/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getMemoryStatusProcedure = publicProcedure.query(async () => {
    return await getMemoryStatus();
});
