import { createRouter } from '../trpc.ts';
import { identityMeProcedure } from './me.ts';

export const identityRouter = createRouter({
    me: identityMeProcedure,
});
