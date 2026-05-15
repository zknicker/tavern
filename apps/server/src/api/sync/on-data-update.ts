import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onDataUpdate = createInvalidationSubscription(tavernEventNames.syncDataUpdated);
