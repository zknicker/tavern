import { createRouter } from '../trpc.ts';
import { convertTaskRoute } from './convert.ts';
import { listTasksRoute } from './list.ts';
import { onTasksUpdate } from './on-update.ts';
import { updateTaskRoute } from './update.ts';

export const taskRouter = createRouter({
    convert: convertTaskRoute,
    list: listTasksRoute,
    onUpdate: onTasksUpdate,
    update: updateTaskRoute,
});
