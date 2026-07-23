import { createRouter } from '../trpc.ts';
import { cancelReminderRoute } from './cancel.ts';
import { listRemindersRoute } from './list.ts';
import { onRemindersUpdate } from './on-update.ts';
import { listReminderRunsRoute } from './runs.ts';

export const reminderRouter = createRouter({
    cancel: cancelReminderRoute,
    list: listRemindersRoute,
    onUpdate: onRemindersUpdate,
    runs: listReminderRunsRoute,
});
