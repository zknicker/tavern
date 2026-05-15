import type { HistoryActorOutput } from '../../lib/trpc.tsx';
import { getSenderColor } from './sender-color.ts';

interface ActorColorInput {
    kind: HistoryActorOutput['kind'];
    primaryColor: string | null;
    profileId?: string | null;
}

export function getActorNameStyle(actor: ActorColorInput | null) {
    if (!actor) {
        return undefined;
    }

    if (actor.primaryColor) {
        return { color: actor.primaryColor };
    }

    if (actor.kind === 'profile' || actor.profileId) {
        return { color: '#64748b' };
    }

    return undefined;
}

export function getActorNameClassName(input: {
    actor: ActorColorInput | null;
    fallbackName: string;
}) {
    return getActorNameStyle(input.actor) ? null : getSenderColor(input.fallbackName);
}
