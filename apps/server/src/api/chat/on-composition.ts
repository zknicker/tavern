import { subscribeToObservedAgentRuntimeComposition } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

// Ephemeral composition stream (I1): a provisional bubble for an in-flight
// agent send. Volatile — no persistence, no replay; clients TTL-fade a
// composition that stops updating and swap it for the durable message when
// `message.created` echoes its compositionId.
export const onChatComposition = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeComposition(options.signal)) {
        yield event;
    }
});
