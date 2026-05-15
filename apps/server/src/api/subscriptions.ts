import type { TavernEventName } from './invalidation-events.ts';
import { subscribeToTavernEvent } from './invalidation-events.ts';
import { publicProcedure } from './trpc.ts';

export function createInvalidationSubscription(eventName: TavernEventName) {
    return publicProcedure.subscription(async function* (options) {
        for await (const event of subscribeToTavernEvent(eventName, options.signal)) {
            yield event;
        }
    });
}
