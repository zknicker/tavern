import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onEngineRestart = createInvalidationSubscription(
    tavernEventNames.engineRestartUpdated
);
