import { listAgentPresence } from '../../agents/presence.ts';
import { publicProcedure } from '../trpc.ts';

export const listAgentPresenceRoute = publicProcedure.query(async () => {
    return {
        presence: await listAgentPresence(),
    };
});
