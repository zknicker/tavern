import { getParticipant, linkParticipantToProfile } from '../storage/participants.ts';
import { ensureSelfProfile, selfProfileId } from './self.ts';

export async function linkParticipantToSelf(participantId: string) {
    const [profile, participant] = await Promise.all([
        ensureSelfProfile(),
        getParticipant(participantId),
    ]);

    if (!profile) {
        throw new Error('Failed to initialize the Tavern profile.');
    }

    if (!participant) {
        throw new Error(`No observed participant named "${participantId}" exists.`);
    }

    await linkParticipantToProfile({
        participantId,
        profileId: selfProfileId,
    });

    return await getParticipant(participantId);
}
