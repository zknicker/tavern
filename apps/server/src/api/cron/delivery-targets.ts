import {
    cronDeliveryTargetListSchema,
    listCronDeliveryTargetsInputSchema,
} from '../../cron/contracts.ts';
import { listCronDeliveryTargets } from '../../cron/delivery-targets.ts';
import { publicProcedure } from '../trpc.ts';

export const listCronDeliveryTargetsRoute = publicProcedure
    .input(listCronDeliveryTargetsInputSchema)
    .output(cronDeliveryTargetListSchema)
    .query(async ({ input }) => await listCronDeliveryTargets(input));
