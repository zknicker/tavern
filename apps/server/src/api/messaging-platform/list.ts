import { listMessagingBindings } from '../../messaging-platform/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listMessagingPlatformsProcedure = publicProcedure.query(async () => {
    return {
        bindings: await listMessagingBindings(),
    };
});
