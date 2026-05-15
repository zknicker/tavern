import { tavernEventNames } from '../invalidation-events.ts';
import { createInvalidationSubscription } from '../subscriptions.ts';

export const onSkillUpdate = createInvalidationSubscription(tavernEventNames.skillUpdated);
