import { subscribeToObservedAgentRuntimeTurnProgress } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnProgress = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnProgress(options.signal)) {
        yield {
            step: event.step,
            turn: event.turn,
        };
    }
});
