import { listParticipants, type Participant } from '../storage/participants.ts';
import {
    resolveParticipantAvatar,
    resolveParticipantColor,
    resolveParticipantName,
} from './presentation.ts';

export function toParticipantCatalogItem(participant: Participant) {
    return {
        accountKey: participant.accountKey,
        avatar: resolveParticipantAvatar(participant),
        externalId: participant.externalId,
        id: participant.id,
        labels: participant.labels,
        name: resolveParticipantName(participant),
        observedName: participant.observedName,
        primaryColor: resolveParticipantColor(participant),
        provider: participant.provider,
        updatedAt: participant.lastSeenAt,
    };
}

export async function listParticipantCatalog() {
    const participants = await listParticipants();

    return {
        participants: participants.map((participant) => toParticipantCatalogItem(participant)),
    };
}
