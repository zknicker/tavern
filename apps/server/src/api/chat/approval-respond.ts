import { respondToTavernChatApproval } from '../../chat/approval.ts';
import { respondToChatApprovalInputSchema } from '../../chat/contracts.ts';
import { publicProcedure } from '../trpc.ts';

export const respondToChatApprovalRoute = publicProcedure
    .input(respondToChatApprovalInputSchema)
    .mutation(async ({ input }) => await respondToTavernChatApproval(input));
