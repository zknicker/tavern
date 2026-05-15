import { useMemo } from 'react';
import type { HistoryActorOutput } from '../../lib/trpc.tsx';
import { useAgentList } from '../agents/use-agent-list.ts';
import { useParticipantList } from '../participants/use-participant-list.ts';

interface ActorProfile {
    avatar: string;
    id: string;
    kind: HistoryActorOutput['kind'];
    name: string;
    primaryColor: string | null;
    profileId?: string | null;
}

export function useActorProfile(actor: HistoryActorOutput | null) {
    const agentsQuery = useAgentList();
    const participantsQuery = useParticipantList();

    return useMemo(() => {
        if (!actor) {
            return null;
        }

        if (actor.kind === 'agent') {
            const agent = agentsQuery.data?.agents.find((entry) => entry.id === actor.id);

            return agent
                ? ({
                      avatar: agent.avatar,
                      id: agent.id,
                      kind: 'agent',
                      name: agent.name,
                      primaryColor: agent.effectivePrimaryColor,
                  } satisfies ActorProfile)
                : null;
        }

        if (actor.kind === 'profile') {
            const profile = participantsQuery.data?.profile;

            return profile && profile.id === actor.id
                ? ({
                      avatar: profile.avatar ?? profile.displayName ?? 'A',
                      id: profile.id,
                      kind: 'profile',
                      name: profile.displayName ?? 'Tavern',
                      primaryColor: profile.primaryColor || null,
                      profileId: profile.id,
                  } satisfies ActorProfile)
                : null;
        }

        const participant = participantsQuery.data?.participants.find(
            (entry) => entry.id === actor.id
        );

        return participant
            ? ({
                  avatar: participant.avatar,
                  id: participant.id,
                  kind: 'participant',
                  name: participant.name,
                  primaryColor: participant.primaryColor || null,
                  profileId: participant.linkedProfileId,
              } satisfies ActorProfile)
            : null;
    }, [
        actor,
        agentsQuery.data?.agents,
        participantsQuery.data?.participants,
        participantsQuery.data?.profile,
    ]);
}
