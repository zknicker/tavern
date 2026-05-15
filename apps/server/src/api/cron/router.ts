import { createRouter } from '../trpc.ts';
import { createCronJobRoute } from './create.ts';
import { deleteCronJobRoute } from './delete.ts';
import { listCronDeliveryTargetsRoute } from './delivery-targets.ts';
import { getCronJobRoute } from './get.ts';
import { listCronJobsRoute } from './list.ts';
import { onCronUpdate } from './on-update.ts';
import { runCronJobRoute } from './run.ts';
import { listCronRunsRoute } from './runs.ts';
import { toggleCronJobRoute } from './toggle.ts';
import { updateCronJobRoute } from './update.ts';

export const cronRouter = createRouter({
    create: createCronJobRoute,
    delete: deleteCronJobRoute,
    deliveryTargets: listCronDeliveryTargetsRoute,
    get: getCronJobRoute,
    list: listCronJobsRoute,
    onUpdate: onCronUpdate,
    run: runCronJobRoute,
    runs: listCronRunsRoute,
    toggle: toggleCronJobRoute,
    update: updateCronJobRoute,
});
