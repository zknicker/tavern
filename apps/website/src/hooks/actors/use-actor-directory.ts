import { useMemo } from 'react';
import type {
    AgentListOutput,
    HistoryActorOutput,
    ParticipantListOutput,
} from '../../lib/trpc.tsx';

interface ResolvedActorProfile {
    avatar: string;
    backgroundColor: string;
    displayName: string | null;
    kind: HistoryActorOutput['kind'] | null;
}

export interface ActorDirectory {
    get: (actor: HistoryActorOutput | null, fallbackName?: null | string) => ResolvedActorProfile;
}

const fallbackPalette = ['#f97316', '#f59e0b', '#2563eb', '#0ea5e9', '#ec4899', '#64748b'];
const initialsSplitPattern = /[^a-zA-Z0-9]+/;

function fallbackAvatar(value: string) {
    const initials = value
        .split(initialsSplitPattern)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

    if (initials) {
        return initials;
    }

    const compact = value.replace(initialsSplitPattern, '').slice(0, 2).toUpperCase();
    return compact || '?';
}

function fallbackColor(value: string) {
    const total = value.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return fallbackPalette[total % fallbackPalette.length] ?? '#64748b';
}

export function useActorDirectory(
    agents: AgentListOutput['agents'],
    participants: ParticipantListOutput['participants']
): ActorDirectory {
    return useMemo(() => {
        const directory = new Map<string, ResolvedActorProfile>();

        for (const agent of agents) {
            directory.set(`agent:${agent.id}`, {
                avatar: agent.avatar,
                backgroundColor: agent.effectivePrimaryColor,
                displayName: agent.name,
                kind: 'agent',
            });
        }

        for (const participant of participants) {
            directory.set(`participant:${participant.id}`, {
                avatar: participant.avatar,
                backgroundColor: participant.primaryColor ?? fallbackColor(participant.name),
                displayName: participant.name,
                kind: 'participant',
            });
        }

        return {
            get(actor, fallbackName) {
                const key = actor ? `${actor.kind}:${actor.id}` : null;
                const known = key ? directory.get(key) : null;

                if (known) {
                    return known;
                }

                const fallback = fallbackName?.trim() || 'unknown';

                return {
                    avatar: fallbackAvatar(fallback),
                    backgroundColor: fallbackColor(fallback),
                    displayName: null,
                    kind: actor?.kind ?? null,
                };
            },
        };
    }, [agents, participants]);
}
