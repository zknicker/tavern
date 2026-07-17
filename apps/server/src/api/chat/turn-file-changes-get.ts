import { z } from 'zod';
import { getChatTurnFileChanges } from '../../chat/turn-file-changes.ts';
import { publicProcedure } from '../trpc.ts';

const getChatTurnFileChangesInputSchema = z.object({
    runId: z.string().regex(/^run_[A-Za-z0-9_-]+$/),
});

export const getChatTurnFileChangesRoute = publicProcedure
    .input(getChatTurnFileChangesInputSchema)
    .query(async ({ input }) => await getChatTurnFileChanges(input.runId));
