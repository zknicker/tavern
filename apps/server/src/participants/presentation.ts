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
    return participant.observedName;
}

export function resolveParticipantAvatar(participant: Participant) {
    return shortName(resolveParticipantName(participant) || participant.id);
}

export function resolveParticipantColor(_participant: Participant) {
    return null;
}
