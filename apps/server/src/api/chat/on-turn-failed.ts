import { subscribeToObservedAgentRuntimeTurnFailed } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnFailed = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnFailed(options.signal)) {
        yield {
            error: event.error,
            turn: event.turn,
        };
    }
});
