import { subscribeToObservedAgentRuntimeTurnStatusUpdated } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnStatusUpdated = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnStatusUpdated(options.signal)) {
        yield {
            sequence: event.sequence,
            timestamp: event.timestamp,
            turn: event.turn,
        };
    }
});
