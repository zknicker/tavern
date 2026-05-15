import { getLiveUsageOverview } from '../../usage/live.ts';
import { publicProcedure } from '../trpc.ts';

export const getLiveUsage = publicProcedure.query(async () => getLiveUsageOverview());
