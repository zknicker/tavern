import { cronDeliveryTargetListSchema } from '../../cron/contracts.ts';
import { listCronDeliveryTargets } from '../../cron/delivery-targets.ts';
import { publicProcedure } from '../trpc.ts';

export const listCronDeliveryTargetsRoute = publicProcedure
    .output(cronDeliveryTargetListSchema)
    .query(async () => await listCronDeliveryTargets());
