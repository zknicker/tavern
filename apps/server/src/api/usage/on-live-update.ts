import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onLiveUsageUpdate = createInvalidationSubscription(tavernEventNames.usageLiveUpdated);
