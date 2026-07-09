import { createRouter } from '../trpc.ts';
import { createLabelRoute } from './create.ts';
import { deleteLabelRoute } from './delete.ts';
import { listLabelsRoute } from './list.ts';
import { onLabelsUpdate } from './on-update.ts';
import { updateLabelRoute } from './update.ts';

export const labelsRouter = createRouter({
    create: createLabelRoute,
    delete: deleteLabelRoute,
    list: listLabelsRoute,
    onUpdate: onLabelsUpdate,
    update: updateLabelRoute,
});
