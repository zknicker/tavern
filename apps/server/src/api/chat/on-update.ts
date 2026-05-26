import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onChatUpdate = createInvalidationSubscription(tavernEventNames.chatUpdated);
