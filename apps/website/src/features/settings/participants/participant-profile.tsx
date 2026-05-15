import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { useParticipantLink } from '../../../hooks/participants/use-participant-link.ts';
import { useParticipantListSuspense } from '../../../hooks/participants/use-participant-list.ts';
import { useParticipantUpdate } from '../../../hooks/participants/use-participant-update.ts';
import { ObservedParticipantList } from './observed-participant-list.tsx';
import { ParticipantCard } from './participant-card.tsx';

export function ParticipantProfile() {
    const [participantsData] = useParticipantListSuspense();
    const linkMutation = useParticipantLink();
    const saveMutation = useParticipantUpdate();
    const participants = participantsData.participants;
    const linkedParticipants = participants.filter((participant) => participant.linkedProfileId);
    const observedParticipants = participants.filter((participant) => !participant.linkedProfileId);

    return (
        <div className="grid gap-10">
            <div>
                <BadgeDivider className="pb-4">Profile</BadgeDivider>
                <ParticipantCard
                    isPending={saveMutation.isPending}
                    linkedParticipants={linkedParticipants}
                    onSave={(input) => {
                        saveMutation.mutate(input);
                    }}
                    profile={participantsData.profile}
                />
            </div>
            <div>
                <BadgeDivider className="pb-4" subtext="External accounts.">
                    Observed Identities
                </BadgeDivider>
                <ObservedParticipantList
                    isPending={linkMutation.isPending}
                    onLink={(participantId) => {
                        linkMutation.mutate({ participantId });
                    }}
                    participants={observedParticipants}
                />
            </div>
        </div>
    );
}
