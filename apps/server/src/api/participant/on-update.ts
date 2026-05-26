import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onParticipantUpdate = createInvalidationSubscription(
    tavernEventNames.participantUpdated
);
