import { describe, expect, test } from 'bun:test';
import { isLocalOwnerActor, localHumanParticipantId } from './use-actor.ts';

describe('isLocalOwnerActor', () => {
    test('the owner is the self profile or the local human participant', () => {
        expect(isLocalOwnerActor({ id: 'profile:self', kind: 'profile' })).toBe(true);
        expect(isLocalOwnerActor({ id: localHumanParticipantId, kind: 'participant' })).toBe(true);
    });

    test('other participants, agents, and other profiles are not the owner', () => {
        expect(isLocalOwnerActor({ id: 'usr_demo', kind: 'participant' })).toBe(false);
        expect(isLocalOwnerActor({ id: 'agt_primary', kind: 'agent' })).toBe(false);
        expect(isLocalOwnerActor({ id: 'profile:other', kind: 'profile' })).toBe(false);
        expect(isLocalOwnerActor(null)).toBe(false);
    });
});
