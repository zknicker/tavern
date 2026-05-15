import { subscribeToObservedAgentRuntimeTurnReplyUpdated } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnReplyUpdated = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnReplyUpdated(options.signal)) {
        yield {
            delta: event.delta,
            isThinking: event.isThinking,
            replace: event.replace,
            text: event.text,
            turn: event.turn,
        };
    }
});
