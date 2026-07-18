import { describe, expect, test } from 'bun:test';
import { isLocalOwnerActor, localHumanParticipantId } from './use-actor.ts';

describe('isLocalOwnerActor', () => {
    test('the current user and legacy owner actors are self', () => {
        expect(isLocalOwnerActor({ id: 'usr_current', kind: 'participant' }, 'usr_current')).toBe(
            true
        );
        expect(isLocalOwnerActor({ id: 'profile:self', kind: 'profile' }, 'usr_current')).toBe(
            true
        );
        expect(
            isLocalOwnerActor({ id: localHumanParticipantId, kind: 'participant' }, 'usr_current')
        ).toBe(true);
    });

    test('other participants, agents, and other profiles are not the owner', () => {
        expect(isLocalOwnerActor({ id: 'usr_other', kind: 'participant' }, 'usr_current')).toBe(
            false
        );
        expect(isLocalOwnerActor({ id: 'agt_primary', kind: 'agent' }, 'usr_current')).toBe(false);
        expect(isLocalOwnerActor({ id: 'profile:other', kind: 'profile' }, 'usr_current')).toBe(
            false
        );
        expect(isLocalOwnerActor(null, 'usr_current')).toBe(false);
    });
});
