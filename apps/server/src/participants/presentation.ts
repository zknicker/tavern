import type { Participant } from '../storage/participants.ts';

const initialsSplitPattern = /[\s:_-]+/;

function shortName(value: string) {
    return value
        .split(initialsSplitPattern)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);
}

export function resolveParticipantName(participant: Participant) {
    return participant.linkedProfile?.displayName ?? participant.observedName;
}

export function resolveParticipantAvatar(participant: Participant) {
    return (
        participant.linkedProfile?.avatar ??
        shortName(resolveParticipantName(participant) || participant.id)
    );
}

export function resolveParticipantColor(participant: Participant) {
    return participant.linkedProfile?.primaryColor?.trim() || null;
}
