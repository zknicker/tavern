import type { SessionRelationshipOutput } from '../../lib/trpc.tsx';

export function getSessionRelationshipName(relationship: SessionRelationshipOutput) {
    return relationship.relatedSession.name;
}

export function formatChannelRelationshipLabel(relationship: SessionRelationshipOutput) {
    return relationship.direction === 'incoming' ? 'Spawned By' : 'Spawned Session';
}
