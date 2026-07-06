import { agentRuntimeGoogleCalendarEventsListInputSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const googleCalendarEventsProcedure = publicProcedure
    .input(agentRuntimeGoogleCalendarEventsListInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.queryGoogleCalendarEvents(input);
        } finally {
            client.close();
        }
    });
