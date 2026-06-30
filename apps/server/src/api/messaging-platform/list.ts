import { listDiscordBindings } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listMessagingPlatformsProcedure = publicProcedure.query(async () => {
    return {
        bindings: await listDiscordBindings(),
    };
});
