import type { SessionMessage } from '../sessions/contracts.ts';
import type { ActorRef } from './contracts.ts';

export function toAgentActor(id: string | null): ActorRef | null {
    return id ? { id, kind: 'agent' } : null;
}

export function toParticipantActor(id: string | null): ActorRef | null {
    return id ? { id, kind: 'participant' } : null;
}

export function getMessageActor(input: {
    fallbackAgentId: string | null;
    message: SessionMessage;
}) {
    if (input.message.actor) {
        return input.message.actor;
    }

    if (input.message.senderType === 'system') {
        return null;
    }

    if (input.message.tavernAgentId) {
        return toAgentActor(input.message.tavernAgentId);
    }

    if (input.message.senderType === 'agent') {
        return toAgentActor(input.fallbackAgentId);
    }

    return null;
}
