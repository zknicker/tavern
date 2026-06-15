import { subscribeToObservedAgentRuntimeTurnCancelled } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnCancelled = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnCancelled(options.signal)) {
        yield event.turn;
    }
});
