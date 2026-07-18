import { describe, expect, test } from 'bun:test';
import { buildRuntimeTavernParticipants } from './runtime-chats.ts';

describe('runtime Tavern chat participants', () => {
    test('preserves historical participants when replacing channel agents', () => {
        const participants = buildRuntimeTavernParticipants(
            ['agt_new_agent'],
            [
                {
                    id: 'agt_primary',
                    kind: 'agent',
                    label: 'Tavern',
                    metadata: { source: 'development-demo' },
                },
                {
                    id: 'usr_demo',
                    kind: 'user',
                    label: null,
                    metadata: { source: 'development-demo' },
                },
            ]
        );

        expect(participants).toEqual([
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { source: 'development-demo' },
            },
            {
                id: 'usr_demo',
                kind: 'user',
                label: null,
                metadata: { source: 'development-demo' },
            },
            {
                id: 'usr_tavern',
                kind: 'user',
                label: 'You',
                metadata: { source: 'tavern' },
            },
            {
                id: 'agt_new_agent',
                kind: 'agent',
                label: null,
                metadata: { agentId: 'agt_new_agent', source: 'tavern' },
            },
        ]);
    });

    test('injects the acting user seat and preserves other human participants', () => {
        const participants = buildRuntimeTavernParticipants(
            ['agt_primary'],
            [{ id: 'usr_other', kind: 'user', label: 'Other', metadata: {} }],
            'usr_current'
        );

        expect(participants).toContainEqual({
            id: 'usr_current',
            kind: 'user',
            label: 'You',
            metadata: { source: 'tavern' },
        });
        expect(participants).toContainEqual({
            id: 'usr_other',
            kind: 'user',
            label: 'Other',
            metadata: {},
        });
    });
});
