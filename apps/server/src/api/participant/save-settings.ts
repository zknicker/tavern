import { z } from 'zod';
import {
    participantAvatarSchema,
    participantDisplayNameSchema,
    participantPrimaryColorSchema,
    saveCatalogProfileSettings,
} from '../../participants/catalog.ts';
import { emitParticipantUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const saveParticipantSettingsInputSchema = z.object({
    avatar: participantAvatarSchema,
    displayName: participantDisplayNameSchema,
    primaryColor: participantPrimaryColorSchema,
});

export const saveParticipantSettings = publicProcedure
    .input(saveParticipantSettingsInputSchema)
    .mutation(async ({ input }) => {
        const profile = await saveCatalogProfileSettings(input);
        emitParticipantUpdated();

        return {
            profile,
        };
    });
