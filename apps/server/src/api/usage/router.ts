import { createRouter } from '../trpc.ts';
import { getLiveUsage } from './live.ts';
import { onLiveUsageUpdate } from './on-live-update.ts';

export const usageRouter = createRouter({
    live: getLiveUsage,
    onLiveUpdate: onLiveUsageUpdate,
});
