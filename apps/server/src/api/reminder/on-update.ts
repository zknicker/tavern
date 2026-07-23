import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onRemindersUpdate = createInvalidationSubscription(tavernEventNames.remindersUpdated);
