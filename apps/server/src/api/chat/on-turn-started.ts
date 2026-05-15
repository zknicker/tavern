import { subscribeToObservedAgentRuntimeTurnStarted } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnStarted = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnStarted(options.signal)) {
        yield event.turn;
    }
});
