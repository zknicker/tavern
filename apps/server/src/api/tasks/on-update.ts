import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onTasksUpdate = createInvalidationSubscription(tavernEventNames.tasksUpdated);
