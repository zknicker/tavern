import { z } from 'zod';
import { linkParticipantToSelf } from '../../participants/link.ts';
import { emitParticipantUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const linkParticipantRoute = publicProcedure
    .input(
        z.object({
            participantId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        const participant = await linkParticipantToSelf(input.participantId);
        emitParticipantUpdated();

        return {
            participant,
        };
    });
