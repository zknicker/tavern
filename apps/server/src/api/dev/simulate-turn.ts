import { simulateChatTurn, simulateTurnInputSchema } from '../../dev/turn-simulation.ts';
import { publicProcedure } from '../trpc.ts';

export const simulateTurnRoute = publicProcedure
    .input(simulateTurnInputSchema)
    .mutation(async ({ input }) => await simulateChatTurn(input));
