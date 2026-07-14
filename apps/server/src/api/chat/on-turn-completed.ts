import { subscribeToObservedAgentRuntimeTurnCompleted } from '../../agent-runtime/events.ts';
import { publicProcedure } from '../trpc.ts';

export const onChatTurnCompleted = publicProcedure.subscription(async function* (options) {
    for await (const event of subscribeToObservedAgentRuntimeTurnCompleted(options.signal)) {
        yield {
            // Absent on runtimes that predate the field; clients treat only
            // an explicit false as "no reply is coming".
            hasReply: event.hasReply ?? null,
            turn: event.turn,
        };
    }
});
