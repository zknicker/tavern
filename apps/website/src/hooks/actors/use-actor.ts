import { useMemo } from 'react';
import type { HistoryActorOutput } from '../../lib/trpc.tsx';
import { useAgentList } from '../agents/use-agent-list.ts';
import { useParticipantList } from '../participants/use-participant-list.ts';
import { useUserProfilePreference } from '../shell/use-user-profile-preference.ts';

interface ActorProfile {
    avatarUrl: string | null;
    id: string;
    isSelf: boolean;
    kind: HistoryActorOutput['kind'];
    name: string;
    primaryColor: string | null;
}

const selfProfileActorId = 'profile:self';
// The app owner is a chat participant with this stable id (see the server's
// `localHumanParticipantId`). The session view also represents the owner with
// the `profile:self` profile actor; both resolve to `isSelf`.
export const localHumanParticipantId = 'usr_tavern';

// True when the actor is the local app owner — either the `profile:self`
// session actor or the `usr_tavern` chat participant.
export function isLocalOwnerActor(actor: HistoryActorOutput | null): boolean {
    if (!actor) {
        return false;
    }

    return (
        (actor.kind === 'profile' && actor.id === selfProfileActorId) ||
        (actor.kind === 'participant' && actor.id === localHumanParticipantId)
    );
}

export function useActorProfile(actor: HistoryActorOutput | null) {
    const agentsQuery = useAgentList();
    const participantsQuery = useParticipantList();
    const userProfile = useUserProfilePreference();

    return useMemo(() => {
        if (!actor) {
            return null;
        }

        if (actor.kind === 'agent') {
            const agent = agentsQuery.data?.agents.find((entry) => entry.id === actor.id);

            return agent
                ? ({
                      avatarUrl: null,
                      id: agent.id,
                      isSelf: false,
                      kind: 'agent',
                      name: agent.name,
                      primaryColor: agent.effectivePrimaryColor,
                  } satisfies ActorProfile)
                : null;
        }

        // The owner — the `profile:self` session actor or the `usr_tavern`
        // chat participant — uses the locally configured name and avatar.
        if (isLocalOwnerActor(actor)) {
            return {
                avatarUrl: userProfile.avatarUrl,
                id: actor.id,
                isSelf: true,
                kind: actor.kind,
                name: userProfile.displayName ?? 'You',
                primaryColor: '#64748b',
            } satisfies ActorProfile;
        }

        if (actor.kind === 'profile') {
            return null;
        }

        const participant = participantsQuery.data?.participants.find(
            (entry) => entry.id === actor.id
        );

        return participant
            ? ({
                  avatarUrl: null,
                  id: participant.id,
                  isSelf: false,
                  kind: 'participant',
                  name: participant.name,
                  primaryColor: participant.primaryColor || null,
              } satisfies ActorProfile)
            : null;
    }, [
        actor,
        agentsQuery.data?.agents,
        participantsQuery.data?.participants,
        userProfile.avatarUrl,
        userProfile.displayName,
    ]);
}
