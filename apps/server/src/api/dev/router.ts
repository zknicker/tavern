import { createRouter } from '../trpc.ts';
import { createClerkSignInTokenRoute } from './create-clerk-sign-in-token.ts';
import { simulateTurnRoute } from './simulate-turn.ts';

export const devRouter = createRouter({
    createClerkSignInToken: createClerkSignInTokenRoute,
    simulateTurn: simulateTurnRoute,
});
