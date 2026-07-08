import { chatTurnEvidenceInputSchema, getChatTurnEvidence } from '../../chat/turn-evidence.ts';
import { publicProcedure } from '../trpc.ts';

export const getChatTurnEvidenceRoute = publicProcedure
    .input(chatTurnEvidenceInputSchema)
    .query(async ({ input }) => await getChatTurnEvidence(input));
