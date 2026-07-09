import { createRouter } from '../trpc.ts';
import { createTaskRoute } from './create.ts';
import { deleteTaskRoute } from './delete.ts';
import { dispatchTaskRoute } from './dispatch.ts';
import { getTaskRoute } from './get.ts';
import { listTasksRoute } from './list.ts';
import { onTasksUpdate } from './on-update.ts';
import { getAutoDispatchSettingsRoute, saveAutoDispatchSettingsRoute } from './settings.ts';
import { updateTaskRoute } from './update.ts';

export const tasksRouter = createRouter({
    create: createTaskRoute,
    delete: deleteTaskRoute,
    dispatch: dispatchTaskRoute,
    get: getTaskRoute,
    autoDispatchSettings: getAutoDispatchSettingsRoute,
    list: listTasksRoute,
    onUpdate: onTasksUpdate,
    saveAutoDispatchSettings: saveAutoDispatchSettingsRoute,
    update: updateTaskRoute,
});
