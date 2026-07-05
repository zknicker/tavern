import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onMemoryJobsUpdate = createInvalidationSubscription(
    tavernEventNames.memoryJobsUpdated
);
