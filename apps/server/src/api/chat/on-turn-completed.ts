import { subscribeToObservedAgentRuntimeTurnCompleted } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnCompleted = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnCompleted(options.signal)) {
        yield event.turn;
    }
});
